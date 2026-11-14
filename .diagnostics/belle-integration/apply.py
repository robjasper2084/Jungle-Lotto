import pathlib,subprocess,sys
root=pathlib.Path(__file__).parent
subprocess.run([sys.executable,str(root/'apply-base.py')],check=True)
subprocess.run([sys.executable,str(root/'refine-render.py')],check=True)
subprocess.run([sys.executable,str(root/'refine-compact.py')],check=True)
