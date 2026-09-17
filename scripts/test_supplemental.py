import unittest
from build_supplemental import (canonical_branch, number, volume_quarters,
    payroll_clients, aggregate_clients, appeals_quarters, summarize, decode_rows)


def row(branch, values, owner='', name='', rn=2, client='0123456789'):
    return {'rawBranch':branch, 'branch':canonical_branch(branch), 'values':values,
            'employeeId':owner, 'name':name, 'row':rn, 'inn':client}


class SupplementalRules(unittest.TestCase):
    def setUp(self):
        self.staff = {'10':{'id':'10','name':'Иванов Иван','branch':'9500','role':'junior'}}

    def test_only_confirmed_source_aliases(self):
        self.assertEqual(canonical_branch('009055'),'9500')
        self.assertEqual(canonical_branch(9056),'9600')
        self.assertEqual(canonical_branch('9057'),'9057')

    def test_missing_geography_is_retained_and_duplicate_raw_keys_rejected(self):
        header = ['div_tb_name','gosb_id','div_gosb_name','inn','client_name','vko_fio',
                  'post_state','position_type','tab_num','priority','signi_code','Получатели в марте','Получатели в июле']
        data = [None,None,None,'0123456789',None,None,None,None,None,None,None,2,3]
        self.assertIn(('','0123456789'),decode_rows([(1,header),(2,data)],'recipients'))
        with self.assertRaises(ValueError):
            decode_rows([(1,header),(2,data),(3,data)],'recipients')

    def test_quarter_formula_uses_cumulative_not_march(self):
        self.assertEqual(volume_quarters([7,30,100,450]),([100,320,30],None))

    def test_missing_operand_is_not_zero(self):
        self.assertEqual(volume_quarters([7,None,100,450]),([100,None,None],None))
        self.assertIsNone(summarize([None])['observed'])
        self.assertIsNone(summarize([0,None])['value'])
        self.assertEqual(summarize([0,None])['observed'],0)

    def test_zero_quarter_is_valid(self):
        self.assertEqual(volume_quarters([7,30,100,130]),([100,0,30],None))
        self.assertEqual(summarize([0])['value'],0)

    def test_negative_difference_is_not_clamped_or_lost(self):
        self.assertEqual(volume_quarters([7,30,100,90]),([100,None,30],-40))

    def test_source_values_are_numeric_nonnegative_and_cents_exact(self):
        self.assertEqual(number('9018.7199999999993',True),901872)
        self.assertEqual(number(0,True),0)
        self.assertIsNone(number(None,True))
        for invalid in ('NaN','Infinity','-1'):
            with self.assertRaises(ValueError): number(invalid,True)
        with self.assertRaises(ValueError): number('1.5')

    def test_alias_join_recovers_pilot_owner_without_copying_payments(self):
        volume = {('9055','0123456789'):row('9055',[None]*4,'10','иванов иван'),
                  ('9500','0123456789'):row('9500',[10,20,30,100],rn=3)}
        recipients = {('9500','0123456789'):row('9500',[2,3])}
        clients,issues,recovered = payroll_clients(volume,recipients,self.staff)
        self.assertEqual(len(clients),1)
        self.assertEqual(issues,[])
        self.assertEqual(clients[0]['employeeId'],'10')
        self.assertEqual(clients[0]['group'],'pilot')
        self.assertEqual([p['value'] for p in clients[0]['volume']],[30,50,20])
        self.assertEqual(recovered,{'junior':1})

    def test_distinct_raw_bank_facts_remain_additive(self):
        volume = {('9055','0123456789'):row('9055',[10,20,30,100],'10','иванов иван'),
                  ('9500','0123456789'):row('9500',[10,20,30,100],rn=3)}
        clients,_,_ = payroll_clients(volume,{},self.staff)
        self.assertEqual([p['value'] for p in clients[0]['volume']],[60,100,40])
        self.assertEqual(clients[0]['rawKeys'],2)

    def test_recipient_only_row_not_removed_by_inner_join(self):
        clients,_,_ = payroll_clients({}, {('9500','0123456789'):row('9500',[2,3])},self.staff)
        self.assertEqual(len(clients),1)
        self.assertEqual(clients[0]['recipients'][0]['value'],2)
        self.assertTrue(all(p['value'] is None for p in clients[0]['volume']))

    def test_volume_months_use_raw_march_july_and_preserve_alias_totals(self):
        volume = {('9055','0123456789'):row('9055',[10,20,300,1000],'10','иванов иван'),
                  ('9500','0123456789'):row('9500',[7,9,200,800],rn=3)}
        clients,_,_ = payroll_clients(volume,{},self.staff)
        stats = aggregate_clients(clients,'volumeMonthly')
        self.assertEqual([s['value'] for s in stats],[17,None,29])
        self.assertEqual([s['months'] for s in stats],[[3],[],[7]])
        self.assertTrue(all(s['basis']=='monthTotal' and not s['partial'] for s in stats))

    def test_missing_march_is_not_replaced_with_cumulative_amount(self):
        clients,_,_ = payroll_clients({('9500','0123456789'):row('9500',[None,20,300,1000])},{},self.staff)
        stats = aggregate_clients(clients,'volumeMonthly')
        self.assertIsNone(stats[0]['observed'])
        self.assertEqual(stats[2]['value'],20)

    def test_recipient_quarters_are_labeled_snapshots_and_q2_missing(self):
        clients,_,_ = payroll_clients({}, {('9500','0123456789'):row('9500',[2,3])},self.staff)
        periods = aggregate_clients(clients,'recipients')
        self.assertEqual([p['value'] for p in periods],[2,None,3])
        self.assertEqual([p['months'] for p in periods],[[3],[],[7]])
        self.assertTrue(all(p['basis']=='monthlySnapshot' for p in periods))

    def test_ambiguous_owner_is_nonpilot_with_audit_issue(self):
        volume = {('9055','0123456789'):row('9055',[10,20,30,100],'10','иванов иван'),
                  ('9500','0123456789'):row('9500',[None]*4,'20','другой человек')}
        clients,issues,_ = payroll_clients(volume,{},self.staff)
        self.assertEqual(clients[0]['group'],'nonpilot')
        self.assertEqual(issues[0]['kind'],'ownerConflict')

    def test_missing_owner_is_nonpilot_and_group_totals_conserve_facts(self):
        volume = {('9500',str(i)):row('9500',[10,20,30,100],owner,name,client=str(i))
                  for i,(owner,name) in enumerate([('10','иванов иван'),('20','другой'),('','')])}
        clients,issues,_ = payroll_clients(volume,{},self.staff)
        self.assertEqual(issues,[])
        self.assertEqual([c['group'] for c in clients],['pilot','nonpilot','nonpilot'])
        pilot = aggregate_clients([c for c in clients if c['group']=='pilot'],'volume')
        nonpilot = aggregate_clients([c for c in clients if c['group']=='nonpilot'],'volume')
        self.assertEqual([p['observed']+n['observed'] for p,n in zip(pilot,nonpilot)],[90,150,60])

    def test_wrong_pilot_name_or_remaining_geography_refused(self):
        for name,branch in [('не тот человек','9500'),('иванов иван','9600')]:
            with self.assertRaises(ValueError):
                payroll_clients({(branch,'0123456789'):row(branch,[10,20,30,100],'10',name)}, {}, self.staff)

    def test_appeals_quarters_without_source_year_and_technical_rows_separate(self):
        header = ['Названия строк','январь','февраль','март','апрель','май','июнь','июль','август','Общий итог']
        rows = [(5,header),(6,['Северо-Западный банк']+[1]*8+[8]),
                (7,['Московский банк']+[2]*8+[16]),(8,['Нет данных']+[3]*8+[24]),
                (9,['Общий итог']+[6]*8+[48])]
        data = appeals_quarters(rows,{'9500':{'id':'9500','tb':'СЗБ'}},self.staff)
        self.assertEqual(data['groups']['pilot'],[3,3,2])
        self.assertEqual(data['groups']['nonpilot'],[6,6,4])
        self.assertEqual(data['groups']['other'],[9,9,6])
        self.assertEqual(data['total'],[18,18,12])
        self.assertTrue(data['periods'][2]['partial'])
        self.assertIsNone(data['sourceYear'])
        self.assertFalse(data['roleBreakdown'])

    def test_incomplete_aggregate_has_observed_not_false_complete_total(self):
        known = {'volume':[summarize([100]),summarize([None]),summarize([20])]}
        unknown = {'volume':[summarize([None]) for _ in range(3)]}
        periods = aggregate_clients([known,unknown],'volume')
        self.assertEqual(periods[0]['observed'],100)
        self.assertIsNone(periods[0]['value'])
        self.assertEqual(periods[0]['status'],'unverified')
        self.assertEqual(periods[1]['status'],'missing')
        self.assertEqual(periods[2]['months'],[7])


if __name__ == '__main__':
    unittest.main()
