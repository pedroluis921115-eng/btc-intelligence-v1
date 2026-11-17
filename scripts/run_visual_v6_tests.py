from pathlib import Path
import subprocess,sys
root=Path(__file__).resolve().parents[1]
tests=[
 ['node','--check','visual-shell.js'],
 ['node','--check','multi-oi.js'],
 ['node','--check','liquidation-visual.js'],
 ['node','--check','market-insights.js'],
 ['node','--check','macro-calendar.js'],
 ['node','--check','corporate-calendar.js'],
 ['node','tests/important_events_v6.test.cjs'],
 ['node','tests/important_events_browser.cjs'],
 ['node','tests/macro_calendar_v6.test.cjs'],
 ['node','tests/macro_calendar_browser.cjs'],
 ['node','tests/multi_oi_v5.test.cjs'],
 ['node','tests/v6_facts_map.test.cjs'],
 ['node','tests/v6_visual_browser.cjs'],
 ['node','tests/visual_v5_browser.cjs'],
 ['node','tests/manual_assistant_v3.test.cjs'],
 ['node','tests/manual_assistant_v4.test.cjs'],
 ['node','tests/manual_assistant_v3_browser.cjs'],
 ['node','tests/manual_assistant_v4_browser.cjs'],
 ['node','tests/v2_replay_final.test.cjs'],
 ['node','tests/v2_heatmap.test.cjs'],
 ['node','tests/v2_oi_six_hour_window.test.cjs'],
 ['node','tests/v2_mobile_h.test.cjs'],
 ['node','tests/v2_model_liquidations_clear_mobile.cjs'],
 ['node','tests/v2_alerts_g.test.cjs'],
 ['node','tests/v2_cross_venue_f.test.cjs'],
 ['node','tests/v2_flow_d.test.cjs'],
 ['node','tests/v2_breakouts_c.test.cjs'],
]
fail=[]
for cmd in tests:
 print('RUN',' '.join(cmd),flush=True)
 try:
  p=subprocess.run(cmd,cwd=root,encoding='utf-8',errors='replace',text=True,capture_output=True,timeout=65)
  for line in (p.stdout+p.stderr).splitlines()[-4:]:print(' ',line[:250],flush=True)
  if p.returncode:fail.append((' '.join(cmd),p.returncode))
  else:print('  PASS',flush=True)
 except subprocess.TimeoutExpired:fail.append((' '.join(cmd),'TIMEOUT'));print('  TIMEOUT',flush=True)
print('V6_SUITE',len(tests),'FAILURES',fail,flush=True)
sys.exit(1 if fail else 0)
