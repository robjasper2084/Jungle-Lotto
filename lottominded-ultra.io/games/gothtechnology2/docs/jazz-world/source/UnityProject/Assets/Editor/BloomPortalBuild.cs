using System;
using System.IO;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEngine;
public static class BloomPortalBuild
{
    public static void Build()
    {
        // Preserve the current authored scene, including the latest musician hand rigs.
        PlayerSettings.WebGL.compressionFormat=WebGLCompressionFormat.Disabled;
        PlayerSettings.WebGL.dataCaching=false;PlayerSettings.WebGL.nameFilesAsHashes=false;
        string output=Path.GetFullPath(Path.Combine(Application.dataPath,"../../Builds/JazzPortal"));
        var report=BuildPipeline.BuildPlayer(new BuildPlayerOptions{scenes=new[]{"Assets/Scenes/BloomThroughGloom.unity"},locationPathName=output,target=BuildTarget.WebGL,options=BuildOptions.None});
        if(report.summary.result!=BuildResult.Succeeded)throw new Exception("Jazz portal build failed: "+report.summary.result);
        Debug.Log("BLOOM_PORTAL_OK: "+report.summary.totalSize+" bytes");
    }
}
