"""Build a small, verifiable BTC-relevant earnings watchlist for GitHub Pages.
Free Nasdaq earnings dates (NOT officially confirmed hours) plus independently
verified overrides. Never infer an exact time from pre/post-market labels.
No API keys, user accounts, continuous local process, or broker orders.
"""
import datetime as dt
import json
import pathlib
import time
import requests

ROOT=pathlib.Path(__file__).resolve().parents[1]
DEST=ROOT/"data"/"corporate-calendar.json"
OVERRIDES=ROOT/"data"/"corporate-verified.json"
NASDAQ="https://api.nasdaq.com/api/calendar/earnings?date={date}"
TICKERS={"NVDA","MSFT","AAPL","AMZN","GOOGL","GOOG","META","TSLA","AMD","AVGO","ORCL","NFLX","MU","PLTR"}
NAMES={"NVDA":"NVIDIA","MSFT":"Microsoft","AAPL":"Apple","AMZN":"Amazon","GOOGL":"Alphabet","GOOG":"Alphabet","META":"Meta","TSLA":"Tesla","AMD":"AMD","AVGO":"Broadcom","ORCL":"Oracle","NFLX":"Netflix","MU":"Micron","PLTR":"Palantir"}
HEADERS={"User-Agent":"Mozilla/5.0","Origin":"https://www.nasdaq.com","Referer":"https://www.nasdaq.com/"}

def get_day(date):
 resp=requests.get(NASDAQ.format(date=date.isoformat()),headers=HEADERS,timeout=10)
 resp.raise_for_status()
 payload=resp.json()
 if payload.get("status",{}).get("rCode",200) not in (200,0,None):
  raise ValueError("Nasdaq non-success status")
 rows=payload.get("data",{}).get("rows")
 if not isinstance(rows,list):raise ValueError("Nasdaq missing rows")
 return rows

def build(now=None):
 now=now or dt.datetime.now(dt.timezone.utc)
 today=now.date()
 collected={}
 errors=[]
 for shift in range(15):
  day=today+dt.timedelta(days=shift)
  try:
   rows=get_day(day)
  except Exception as exc:
   errors.append((day.isoformat(),str(exc)[:95]))
   continue
  for row in rows:
   symbol=str(row.get("symbol") or "").upper().strip()
   if symbol not in TICKERS:continue
   if symbol=="GOOG" and (day.isoformat(),"GOOGL") in collected:continue
   timing={"time-before-market":"before","time-pre-market":"before","time-after-hours":"after","time-during-market":"during"}.get(str(row.get("time")),"unknown")
   item={"id":"nasdaq-"+symbol+"-"+day.isoformat(),"symbol":symbol,"name":NAMES[symbol],
    "date":day.isoformat(),"exactTime":None,"session":timing,"tier":"CRITICO" if symbol=="NVDA" else "IMPORTANTE",
    "officialConfirmed":False,"source":"Nasdaq Earnings Calendar",
    "sourceUrl":"https://www.nasdaq.com/market-activity/earnings",
    "verifiedOn":None}
   collected[(day.isoformat(),symbol)]=item
  time.sleep(.08)
 if len(errors)>3:raise RuntimeError("Nasdaq API incomplete: "+str(errors[:4]))
 overrides=json.loads(OVERRIDES.read_text(encoding="utf-8"))
 if not isinstance(overrides,list):raise ValueError("Invalid corporate verified overrides")
 for e in overrides:
  day=dt.date.fromisoformat(e["date"])
  if not (today<=day<=today+dt.timedelta(days=14)):continue
  if e["symbol"] not in TICKERS or not str(e["sourceUrl"]).startswith("https://investor."):
   raise ValueError("Unverified official corporate source")
  if dt.datetime.fromisoformat(e["exactTime"].replace("Z","+00:00")).date() not in {day,day+dt.timedelta(days=1)}:
   raise ValueError("Official event timestamp inconsistent")
  collected[(e["date"],e["symbol"])]=e
 events=sorted(collected.values(),key=lambda x:(x["date"],x.get("exactTime") or "Z",x["symbol"]))[:80]
 out={"generatedAt":now.replace(microsecond=0).isoformat().replace("+00:00","Z"),
   "source":"Nasdaq earnings dates + directly verified corporate investor releases",
   "windowStart":today.isoformat(),"windowEnd":(today+dt.timedelta(days=14)).isoformat(),
   "scope":"Selected systemically relevant technology companies only; not an exhaustive earnings calendar",
   "events":events}
 DEST.parent.mkdir(exist_ok=True)
 temp=DEST.with_suffix(".json.tmp")
 temp.write_text(json.dumps(out,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
 temp.replace(DEST)
 return out

if __name__=="__main__":
 out=build()
 print("CORPORATE_CALENDAR_PASS",out["generatedAt"],len(out["events"]))
 for e in out["events"][:7]:print(e["date"],e["symbol"],e.get("exactTime"),e["officialConfirmed"])
