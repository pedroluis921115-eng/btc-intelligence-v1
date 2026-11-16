from pathlib import Path
import subprocess,sys,time
root=Path(__file__).resolve().parents[1]
commands=[
 ['node','--check','app.js'],
 ['node','--check','radar.js'],
 ['node','--check','planner.js'],
 ['node','tests/manual_assistant_v3.test.cjs'],
 ['node','tests/manual_assistant_v3_browser.cjs'],
 ['node','tests/v2_replay_final.test.cjs'],
 ['node','tests/v2_heatmap.test.cjs'],
 ['node','tests/v2_oi_six_hour_window.test.cjs'],
 ['node','tests/v2_mobile_h.test.cjs'],
 ['node','tests/v2_model_liquidations_clear_mobile.cjs'],
]
failed=[]
for command in commands:
 print('RUN',' '.join(command),flush=True)
 try:
  r=subprocess.run(command,cwd=root,text=True,encoding='utf-8',errors='replace',capture_output=True,timeout=65)
  for line in (r.stdout+r.stderr).splitlines()[-9:]:print(' ',line[:250],flush=True)
  if r.returncode!=0:failed.append((' '.join(command),r.returncode))
  else:print('  => PASS',flush=True)
 except subprocess.TimeoutExpired:failed.append((' '.join(command),'TIMEOUT'));print('  => TIMEOUT',flush=True)
print('SUITE_TOTAL',len(commands),'FAILURES',failed,flush=True)
sys.exit(1 if failed else 0)
