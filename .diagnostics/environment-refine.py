import pathlib,subprocess,sys
root=pathlib.Path(__file__).parent
subprocess.run([sys.executable,str(root/'environment-refine-base.py'),*sys.argv[1:]],check=True)
subprocess.run([sys.executable,str(root/'environment-visual-fix.py'),*sys.argv[1:]],check=True)
