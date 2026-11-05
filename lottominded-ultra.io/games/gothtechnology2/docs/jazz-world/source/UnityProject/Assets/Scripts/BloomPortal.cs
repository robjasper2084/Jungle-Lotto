using System;
using System.Collections;
using System.Runtime.InteropServices;
using UnityEngine;
namespace DigitalStatic.Bloom
{
    public sealed class BloomPortal : MonoBehaviour
    {
        public static bool Active;
        BloomGame game;float nextStatus;
        [Serializable] class Entry {public string mode;}
        [Serializable] class InputState {public float throttle,steer;}
        [Serializable] class Status {public string mode;public bool paused,music,boost,cinematic;public float speed,distance,wheelDistance;public float x,y,z;}
#if UNITY_WEBGL && !UNITY_EDITOR
        [DllImport("__Internal")] static extern void BloomReady();
        [DllImport("__Internal")] static extern void BloomStatus(string value);
#endif
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        static void Attach(){var game=FindFirstObjectByType<BloomGame>();if(game&&!game.GetComponent<BloomPortal>())game.gameObject.AddComponent<BloomPortal>();}
        IEnumerator Start()
        {
            game=GetComponent<BloomGame>();yield return null;
#if UNITY_WEBGL && !UNITY_EDITOR
            // Some installed Unity Web modules omit this optional managed input API.
            var capture=Type.GetType("UnityEngine.WebGLInput, UnityEngine.WebGLModule")?.GetProperty("captureAllKeyboardInput");
            capture?.SetValue(null,false);BloomReady();
#endif
        }
        public void PortalEnter(string json)
        {
            Active=true;var entry=JsonUtility.FromJson<Entry>(json);
            // Enter the world immediately. Sound requires a deliberate music-button press.
            game.music.Muted=true;game.music.source.volume=0;game.BeginRide();
            game.ride.SetWalking(entry.mode=="walk");
        }
        public void PortalInput(string json)
        {
            var input=JsonUtility.FromJson<InputState>(json);
            game.ride.TouchThrottle=Mathf.Clamp(input.throttle,-1,1);game.ride.TouchSteer=Mathf.Clamp(input.steer,-1,1);
        }
        public void PortalCommand(string command)
        {
            if(!game)return;
            switch(command)
            {
                case "mode":game.ride.SetWalking(!game.ride.OnFoot);break;
                case "camera":game.FirstPerson=!game.FirstPerson;game.Cinematic=game.Photo=false;game.ride.Active=!game.Paused;break;
                case "hop":game.ride.Jump();break;
                case "boost":game.ride.Boost=!game.ride.Boost;break;
                case "recover":game.ride.Recover();break;
                case "pause":game.PauseGame(!game.Paused);break;
                case "suspend":game.ride.ClearInput();game.PauseGame(true);break;
                case "clear":game.ride.ClearInput();break;
                case "music":game.music.ToggleMute();break;
                case "performance":
                    if(game.Cinematic){game.Cinematic=false;game.ride.Active=!game.Paused;}
                    else game.BeginCinema(false);
                    break;
            }
        }
        void Update()
        {
            if(!game)return;
            if(game.Playing&&!game.Paused&&Input.GetKeyDown(KeyCode.Q))game.ride.SetWalking(!game.ride.OnFoot);
            if(!Active||Time.unscaledTime<nextStatus)return;nextStatus=Time.unscaledTime+.2f;
            var walk=game.ride.GetComponent<BloomWalk>();var p=game.ride.transform.position;
#if UNITY_WEBGL && !UNITY_EDITOR
            BloomStatus(JsonUtility.ToJson(new Status{mode=game.Cinematic?"Performance":game.ride.OnFoot?"Walking":"Riding",cinematic=game.Cinematic,paused=game.Paused,music=!game.music.Muted,boost=game.ride.Boost,speed=Mathf.Abs(game.ride.Speed)*3.6f,distance=game.ride.Distance,wheelDistance=walk?walk.WheelDistance:0,x=p.x,y=p.y,z=p.z}));
#endif
        }
        void OnDestroy(){Active=false;}
    }
}
