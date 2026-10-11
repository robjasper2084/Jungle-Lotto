using System;
using System.Collections;
using UnityEngine;

namespace DigitalStatic.Bloom
{
    [DefaultExecutionOrder(200)]
    public sealed class BloomGame : MonoBehaviour
    {
        public Transform world,stageSinger,gardenSinger,riverSinger,maleSinger;
        public BloomRide ride;
        public Camera view;
        public BloomMusic music;
        public Transform[] memories;
        public bool Playing,Cinematic,Paused,Photo,FirstPerson;
        public int Collected;
        public bool Complete;
        public bool Smoke;
        bool[] collected;
        Vector3 spawn, cameraVelocity;
        Quaternion heading;
        float orbitYaw,orbitPitch=14,orbitDistance=5.7f;
        int cinematicShot=-1;
        BloomCinemaEdit edit;
        BloomFilm film;
        public int CutCount=>edit?.shots?.Length??0;
        public int CurrentCut=>cinematicShot;
        public string CurrentShotKind=>cinematicShot>=0?edit.shots[cinematicShot].kind:"menu";
        Vector3 mouse;
        GUIStyle title,body,small,button,speedStyle;
        Texture2D pixel;
        string notice="";
        float noticeUntil;
        public Transform Anchor(string name)=>BloomRide.Find(world,name);

        void Start()
        {
#if UNITY_WEBGL && !UNITY_EDITOR
            Smoke=false;
#else
            Smoke=Array.Exists(Environment.GetCommandLineArgs(),a=>a=="--smoke");
#endif
            spawn=ride.transform.position;heading=ride.transform.rotation;
            edit=JsonUtility.FromJson<BloomCinemaEdit>(Resources.Load<TextAsset>("Audio/FilmCuts").text);
            film=view.GetComponent<BloomFilm>();
            collected=new bool[memories.Length];
            foreach(var p in memories)CreateEcho(p);
            mouse=Input.mousePosition;
            if(Smoke)gameObject.AddComponent<BloomSmoke>();
        }
        void CreateEcho(Transform anchor)
        {
            var light=GameObject.CreatePrimitive(PrimitiveType.Sphere);
            light.name="EchoBloom";Destroy(light.GetComponent<SphereCollider>());
            light.transform.SetParent(anchor,false);light.transform.localScale=Vector3.one*.26f;
            var m=new Material(Shader.Find("Standard"));
            m.color=new Color(.95f,.93f,.87f);m.EnableKeyword("_EMISSION");
            m.SetColor("_EmissionColor",new Color(.7f,.66f,.55f));
            light.GetComponent<Renderer>().material=m;
            var label=new GameObject("Echo label");label.transform.SetParent(anchor,false);
            label.transform.localPosition=Vector3.up*.42f;
            var text=label.AddComponent<TextMesh>();text.text=(Array.IndexOf(memories,anchor)+1).ToString("00");
            text.fontSize=44;text.characterSize=.038f;text.anchor=TextAnchor.MiddleCenter;
            text.color=new Color(.85f,.84f,.79f);
        }
        public void BeginRide()
        {
            Playing=true;Cinematic=Photo=Paused=false;Time.timeScale=1;
            ride.Active=true;ride.ClearInput();music.Begin();
            Say("Follow the flowers. Find three echoes.");
        }
        public void BeginCinema(bool restart=true)
        {
            Playing=true;Cinematic=true;Photo=Paused=false;Time.timeScale=1;
            ride.Active=false;ride.ClearInput();cinematicShot=-1;music.Begin(restart);
        }
        public void PauseGame(bool value)
        {
            if(!Playing)return;
            Paused=value;Time.timeScale=value?0:1;
            ride.Active=!value&&!Cinematic&&!Photo;ride.ClearInput();
            if(value)music.source.Pause();else music.source.UnPause();
        }
        void Menu()
        {
            Playing=Paused=Cinematic=Photo=false;Time.timeScale=1;
            ride.Active=false;ride.ClearInput();music.source.Stop();
        }
        void Say(string message){notice=message;noticeUntil=Time.unscaledTime+4;}
        void Update()
        {
            if(Playing)
            {
                if(Input.GetKeyDown(KeyCode.Escape))PauseGame(!Paused);
                if(!Paused)
                {
                    if(Input.GetKeyDown(KeyCode.M))music.ToggleMute();
                    if(Input.GetKeyDown(KeyCode.C)){FirstPerson=!FirstPerson;Photo=false;ride.Active=!Cinematic;cameraVelocity=Vector3.zero;}
                    if(Input.GetKeyDown(KeyCode.R))ride.Recover();
                    if(Input.GetKeyDown(KeyCode.V))
                    {
                        if(Cinematic){Cinematic=false;ride.Active=true;cameraVelocity=Vector3.zero;}
                        else BeginCinema(false);
                    }
                    if(Input.GetKeyDown(KeyCode.F))
                    {
                        Photo=!Photo;Cinematic=false;ride.Active=!Photo;ride.ClearInput();
                        orbitYaw=ride.transform.eulerAngles.y;
                    }
                    if(Input.GetKeyDown(KeyCode.E) && Vector3.Distance(ride.transform.position,stageSinger.position)<12)
                        BeginCinema(false);
                    if(!Cinematic)
                    {
                        for(int i=0;i<memories.Length;i++)
                        {
                            if(collected[i])continue;
                            Vector3 d=ride.transform.position-memories[i].position;d.y=0;
                            if(d.sqrMagnitude<10)
                            {
                                collected[i]=true;Collected++;memories[i].gameObject.SetActive(false);
                                ride.Remember(ride.transform.position);Say("Echo "+Collected+" / 3");
                            }
                        }
                        if(!Complete && Collected==3 && Vector3.Distance(ride.transform.position,stageSinger.position)<11)
                        {
                            Complete=true;music.petals.Emit(130);Say("The music found you. Stay a while.");
                        }
                    }
                }
            }
            foreach(var anchor in memories)
            {
                if(!anchor.gameObject.activeSelf)continue;
                var echo=anchor.Find("EchoBloom");if(echo)echo.localPosition=Vector3.up*(Mathf.Sin(music.Clock*1.8f)*.10f);
                var text=anchor.Find("Echo label");if(text)text.rotation=Quaternion.LookRotation(text.position-view.transform.position);
            }
            mouse=Input.mousePosition;
        }
        void LateUpdate()
        {
            if(Paused)return;
            view.cullingMask=Playing&&FirstPerson&&!Cinematic&&!Photo?~(1<<8):~0;
            Vector3 position,target;float fov=54;
            if(!Playing)
            {
                position=gardenSinger.position+new Vector3(.4f+Mathf.Sin(Time.time*.12f)*.12f,1.72f,-3.2f);
                target=FaceTarget(gardenSinger);fov=42;
            }
            else if(Cinematic)
            {
                float t=music.Clock;
                int shot=edit.At(t);var cut=edit.shots[shot];
                Vector3 forward=(Anchor("StageAnchor").position-Anchor("SpawnAnchor").position).normalized;
                forward.y=0;forward.Normalize();Vector3 right=Vector3.Cross(Vector3.up,forward);
                Transform subject=stageSinger;
                if(cut.kind.StartsWith("garden"))subject=gardenSinger;
                if(cut.kind.StartsWith("river"))subject=riverSinger;
                if(cut.kind=="bass")subject=Anchor("Band_Bassist");
                if(cut.kind=="piano")subject=Anchor("Band_Pianist");
                if(cut.kind=="drums")subject=Anchor("Band_Drummer");
                if(cut.kind=="male_close")subject=maleSinger;
                float end=shot+1<edit.shots.Length?edit.shots[shot+1].start:music.source.clip.length;
                float progress=Mathf.SmoothStep(0,1,Mathf.Clamp01((t-cut.start)/Mathf.Max(.1f,end-cut.start)));
                var offset=Vector3.Lerp(cut.offset,cut.endOffset,progress);
                position=subject.position+right*offset.x+Vector3.up*offset.y+forward*offset.z;
                target=cut.kind=="piano"||cut.kind=="drums"?subject.position+Vector3.up*1.10f:cut.kind=="bass"?subject.position+Vector3.up*1.60f:FaceTarget(subject);
                fov=cut.fov;
                if(shot!=cinematicShot)
                {
                    film.BeginCut(cut.dissolve?.32f:0);
                    view.transform.position=position;view.fieldOfView=fov;cinematicShot=shot;cameraVelocity=Vector3.zero;
                }
            }
            else if(Photo)
            {
                orbitYaw+=(Input.GetKey(KeyCode.RightArrow)?1:Input.GetKey(KeyCode.LeftArrow)?-1:0)*Time.deltaTime*38;
                orbitPitch=Mathf.Clamp(orbitPitch+(Input.GetKey(KeyCode.UpArrow)?1:Input.GetKey(KeyCode.DownArrow)?-1:0)*Time.deltaTime*25,-5,65);
                orbitDistance=Mathf.Clamp(orbitDistance-Input.mouseScrollDelta.y*.4f,1.9f,16);
                target=ride.transform.position+Vector3.up*1.1f;
                position=target+Quaternion.Euler(orbitPitch,orbitYaw,0)*new Vector3(0,.25f,-orbitDistance);fov=50;
            }
            else if(FirstPerson)
            {
                position=ride.transform.position+Vector3.up*1.73f+ride.transform.forward*.04f;
                position+=Vector3.up*Mathf.Sin(music.Clock*3.2f)*Mathf.Abs(ride.Speed)*.0009f;
                target=position+ride.transform.forward*7+Vector3.up*(-.13f+ride.Speed*.0015f);fov=67;
            }
            else
            {
                target=ride.transform.position+Vector3.up*1.28f+ride.transform.forward*1.1f;
                position=ride.transform.position-ride.transform.forward*4.5f+Vector3.up*2.5f;
                Vector3 delta=position-target;
                if(Physics.SphereCast(target,.16f,delta.normalized,out var hit,delta.magnitude,~(1<<8),QueryTriggerInteraction.Ignore))
                    position=hit.point-delta.normalized*.24f;
                fov=58+Mathf.Abs(ride.Speed)*.25f;
            }
            float smooth=FirstPerson&&!Photo&&!Cinematic?.045f:.18f;
            view.transform.position=Vector3.SmoothDamp(view.transform.position,position,ref cameraVelocity,smooth);
            if(film){film.FocusDistance=Vector3.Distance(view.transform.position,target);film.FocusStrength=Cinematic?.38f:!Playing?.25f:0;}
            view.fieldOfView=BloomRide.Damp(view.fieldOfView,fov,5,Time.deltaTime);
            var rotation=Quaternion.LookRotation(target-view.transform.position);
            if(!Playing || Cinematic)
            {
                // Aim the performer at the golden-ratio intersection in viewport space.
                float tangent=Mathf.Tan(view.fieldOfView*Mathf.Deg2Rad*.5f);
                var goldenRay=new Vector3(.236068f*tangent*view.aspect,.236068f*tangent,1).normalized;
                rotation*=Quaternion.FromToRotation(goldenRay,Vector3.forward);
                view.transform.rotation=rotation;
            }
            else
            {
            if(FirstPerson&&!Cinematic&&!Photo)rotation*=Quaternion.Euler(0,0,-ride.Bank*Mathf.Rad2Deg*.20f);
            view.transform.rotation=Quaternion.Slerp(view.transform.rotation,rotation,1-Mathf.Exp(-12*Time.deltaTime));
            }
        }
        Vector3 FaceTarget(Transform subject)
        {
            var face=BloomRide.Find(subject,"FaceTarget");
            if(!face)face=BloomRide.Find(subject,"MaleFaceTarget");
            return face?face.position:subject.position+Vector3.up*1.64f;
        }
        void OnApplicationFocus(bool focus){if(!focus && !Smoke && !BloomPortal.Active && Playing && !Paused)PauseGame(true);}
        void Styles()
        {
            if(title!=null)return;
            pixel=new Texture2D(1,1);pixel.SetPixel(0,0,Color.white);pixel.Apply();
            title=new GUIStyle{fontSize=67,fontStyle=FontStyle.Bold,normal={textColor=new Color(.96f,.95f,.91f)}};
            body=new GUIStyle{fontSize=21,normal={textColor=new Color(.91f,.90f,.85f)},wordWrap=true};
            small=new GUIStyle{fontSize=14,normal={textColor=new Color(.75f,.77f,.72f)},wordWrap=true};
            button=new GUIStyle(GUI.skin.button){fontSize=17,fontStyle=FontStyle.Bold,alignment=TextAnchor.MiddleCenter};
            speedStyle=new GUIStyle(title){fontSize=46};
        }
        void Rect(Rect rect,Color color){GUI.color=color;GUI.DrawTexture(rect,pixel);GUI.color=Color.white;}
        bool Button(Rect rect,string text)=>GUI.Button(rect,text,button);
        void OnGUI()
        {
            if(BloomPortal.Active)return;
            Styles();
            GUI.matrix=Matrix4x4.TRS(Vector3.zero,Quaternion.identity,new Vector3(Screen.width/1600f,Screen.height/900f,1));
            if(!Playing)
            {
                Rect(new Rect(0,0,650,900),new Color(.018f,.026f,.023f,.79f));
                Rect(new Rect(77,90,62,2),new Color(.8f,.8f,.74f));
                GUI.Label(new Rect(77,112,550,26),"DIGITAL STATIC  /  SWOOP DETROIT",small);
                GUI.Label(new Rect(72,165,570,258),"BLOOM\nTHROUGH\nGLOOM",title);
                GUI.Label(new Rect(78,438,475,62),"Ride into the music.\nA garden, a river, a moment to stay.",body);
                if(Button(new Rect(78,538,365,58),"BEGIN THE RIDE"))BeginRide();
                if(Button(new Rect(78,614,365,53),"WATCH THE PERFORMANCE"))BeginCinema();
                if(Button(new Rect(78,688,175,36),music.Muted?"MUSIC OFF":"MUSIC ON"))music.ToggleMute();
                GUI.Label(new Rect(78,772,465,66),"WASD ride  ·  Space hop  ·  C camera\nF photo  ·  V cinema  ·  Esc pause",small);
                return;
            }
            if(Paused)
            {
                Rect(new Rect(0,0,1600,900),new Color(0,0,0,.57f));
                Rect(new Rect(545,174,510,544),new Color(.03f,.041f,.035f,.96f));
                GUI.Label(new Rect(587,205,450,57),"STAY A WHILE",new GUIStyle(title){fontSize=38});
                if(Button(new Rect(592,299,416,55),"RESUME"))PauseGame(false);
                if(Button(new Rect(592,374,416,48),"RESTART THE MUSIC")){music.source.time=0;PauseGame(false);}
                if(Button(new Rect(592,442,416,48),music.Muted?"TURN MUSIC ON":"TURN MUSIC OFF"))music.ToggleMute();
                GUI.Label(new Rect(592,514,400,25),"Music motion timing",small);
                float offset=GUI.HorizontalSlider(new Rect(594,548,411,25),music.Offset,-.3f,.3f);
                if(Mathf.Abs(offset-music.Offset)>.001f){music.Offset=offset;PlayerPrefs.SetFloat("Bloom.MusicOffset",offset);}
                if(Button(new Rect(592,610,416,46),"MAIN MENU"))Menu();
                return;
            }
            GUI.Label(new Rect(34,26,430,28),"SWOOP DETROIT / BLOOM",small);
            if(!Cinematic)
            {
                GUI.Label(new Rect(34,797,190,60),(Mathf.Abs(ride.Speed)*3.6f).ToString("00"),speedStyle);
                GUI.Label(new Rect(145,835,70,20),"KM/H",small);
                GUI.Label(new Rect(680,29,240,30),"ECHOES  "+Collected+" / 3",body);
                GUI.Label(new Rect(545,827,600,36),Complete?"The terrace is yours.  E to watch.":Collected<3?"Follow the flowers. Find three echoes.":"Ride to the waterfront performance.",body);
            }
            else
            {
                Rect(new Rect(0,0,1600,40),Color.black);Rect(new Rect(0,862,1600,38),Color.black);
                GUI.Label(new Rect(34,811,800,33),"BLOOM THROUGH GLOOM  /  THE PERFORMANCE",small);
                Rect(new Rect(34,851,1532,2),new Color(1,1,1,.16f));
                Rect(new Rect(34,851,1532*Mathf.Clamp01(music.Clock/music.source.clip.length),2),new Color(.91f,.90f,.84f));
            }
            GUI.Label(new Rect(1190,31,376,30),music.Muted?"M  MUSIC OFF":"M  MUSIC ON",small);
            GUI.Label(new Rect(1190,59,376,30),Cinematic?"V  RETURN TO RIDE":Photo?"F  LEAVE PHOTO VIEW":"C  CAMERA  /  F  PHOTO",small);
            if(ride.Crashed)GUI.Label(new Rect(520,390,600,80),"Lost your balance. R to recover.",body);
            if(Time.unscaledTime<noticeUntil&&!Cinematic)GUI.Label(new Rect(485,112,670,40),notice,body);
        }
    }
}
