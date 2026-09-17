import tempfile, unittest
from pathlib import Path
from build_dashboard import ident, inn, norm, read_optional, week_bucket, weekly_distribution, survey_period, survey_summary
from collections import Counter
from datetime import date

class ImportRules(unittest.TestCase):
    def test_survey_weeks_preserve_scores_and_missing_is_not_zero(self):
        rows=[{'employeeId':'1','name':'A','date':'2026-07-01T10:00:00','scores':[1,2,3,2]},
              {'employeeId':'1','name':'A','date':'2026-07-02T10:00:00','scores':[3,3,3,3]},
              {'employeeId':'2','name':'B','date':'2026-07-13T10:00:00','scores':[1,1,1,1]}]
        result=survey_period(rows,2026,3,date(2026,8,31))
        first=result['weeks'][0];self.assertEqual(first['responses'],2);self.assertEqual(first['sample'],1)
        self.assertAlmostEqual(first['process']['value'],2.5)
        self.assertIsNone(result['weeks'][1]['process']['value'])
        self.assertEqual(result['weeks'][1]['responses'],0)
        self.assertEqual(result['weeks'][-1]['end'],'2026-08-31')
        self.assertAlmostEqual(survey_summary(rows)['process']['value'],2)

    def test_identifiers_preserve_client_zeroes(self):
        self.assertEqual(inn('323092545'),'0323092545')
        self.assertEqual(inn('0323092545'),'0323092545')
        self.assertEqual(inn('012345678901'),'012345678901')
        self.assertEqual(ident('000904811'),'904811')
        self.assertIsNone(inn('ИНН неизвестен'))

    def test_name_normalization_is_not_fuzzy(self):
        self.assertEqual(norm('  Пётр  Иванов '),norm('петр иванов'))
        self.assertNotEqual(norm('Иванов И.'),norm('Иванов Иван Иванович'))

    def test_future_sources_are_unknown_without_file(self):
        self.assertEqual(read_optional(None,'payroll'),[])

    def parse(self,text):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'payroll.csv';p.write_text(text)
            return read_optional(p,'payroll')

    def test_valid_zero_is_preserved(self):
        r=self.parse('employeeId,quarter,sourceId,volume,recipients\n00010,3,source-1,0,0\n')[0]
        self.assertEqual(r['volume'],0);self.assertEqual(r['employeeId'],'10')

    def test_duplicate_employee_quarter_rejected(self):
        with self.assertRaises(AssertionError):self.parse('employeeId,quarter,sourceId,volume,recipients\n10,3,a,100,2\n10,3,b,200,3\n')

    def test_nonfinite_and_negative_values_rejected(self):
        for v in ('inf','nan','-1'):
            with self.subTest(value=v),self.assertRaises(AssertionError):self.parse(f'employeeId,quarter,sourceId,volume,recipients\n10,3,a,{v},2\n')

    def test_missing_fields_rejected(self):
        with self.assertRaises(AssertionError):self.parse('employeeId,quarter,sourceId\n10,3,a\n')

    def test_weekly_partition_preserves_unknown_and_outside_dates(self):
        end=date(2026,8,31)
        dates=['2026-06-30','2026-07-01','2026-07-05','2026-07-06','2026-08-31','2026-09-01',None]
        counts=Counter(week_bucket(d,2026,3,end) for d in dates)
        result=weekly_distribution(counts,2026,3,end)
        self.assertEqual(result['weeks'][0],{'id':'2026-06-29','start':'2026-07-01','end':'2026-07-05','partial':True,'count':2})
        self.assertEqual(result['weeks'][1]['count'],1)
        self.assertEqual(result['weeks'][-1]['start'],'2026-08-31')
        self.assertTrue(result['weeks'][-1]['partial'])
        self.assertEqual([result[k] for k in ('before','undated','after')],[1,1,1])
        self.assertEqual(sum(w['count'] for w in result['weeks'])+3,len(dates))

    def test_weekly_empty_week_is_real_zero_and_full_quarter_is_clipped(self):
        result=weekly_distribution(Counter(),2026,1,date(2026,8,31))
        self.assertEqual(result['weeks'][-1]['end'],'2026-03-31')
        self.assertTrue(all(w['count']==0 for w in result['weeks']))
        self.assertFalse(result['weeks'][1]['partial'])

if __name__=='__main__':unittest.main()
