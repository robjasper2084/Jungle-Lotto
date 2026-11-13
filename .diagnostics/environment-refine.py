import pathlib,subprocess,sys
root=pathlib.Path(__file__).parent
subprocess.run([sys.executable,str(root/'environment-refine-base.py'),*sys.argv[1:]],check=True)
subprocess.run([sys.executable,str(root/'environment-visual-fix.py'),*sys.argv[1:]],check=True)
if len(sys.argv)>1 and sys.argv[1]=='candidate':subprocess.run([sys.executable,str(root/'environment-density-fix.py')],check=True)
