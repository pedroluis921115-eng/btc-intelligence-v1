from pathlib import Path
import subprocess,sys
root=Path(__file__).resolve().parents[1]
commands=[
 ['node','--check','app.js'],
 ['node','--check','radar.js'],
 ['node','--check','planner.js'],
 ['node','--check','decision-assistant.js'],
 ['node','--check','manual-journal.js'],
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
errors=[]
for cmd in commands:
 print('RUN',' '.join(cmd),flush=True)
 try:
  result=subprocess.run(cmd,cwd=root,text=True,encoding='utf-8',errors='replace',capture_output=True,timeout=65)
  for line in (result.stdout+result.stderr).splitlines()[-7:]:print(' ',line[:265],flush=True)
  if result.returncode:errors.append((' '.join(cmd),result.returncode))
  else:print('  PASS',flush=True)
 except subprocess.TimeoutExpired:errors.append((' '.join(cmd),'TIMEOUT'));print('  TIMEOUT',flush=True)
print('SUITE_V4',len(commands),'FAILURES',errors,flush=True)
sys.exit(bool(errors))
