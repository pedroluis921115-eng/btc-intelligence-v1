from pathlib import Path
import os
from PIL import Image
root=Path(__file__).resolve().parents[1]
dest=Path(os.environ['LOCALAPPDATA'])/'BTC-Intelligence'
dest.mkdir(parents=True,exist_ok=True)
source=root/'icon-512.png'
with Image.open(source) as im:
 im.convert('RGBA').save(dest/'BTC-Intelligence.ico',format='ICO',sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])
print('ICON_READY',dest/'BTC-Intelligence.ico')
