using UnityEngine;

namespace DigitalStatic.Bloom
{
    // Port of the local RideCore jerk limiter and critically damped spring.
    // Collision, controls and integration here belong to the Unity prototype.
    public sealed class BloomRide : MonoBehaviour
    {
        public Transform visual;
        public bool Active, Crashed;
        public float Speed, Distance, Bank;
        public int Hops, Landings, Contacts;
        public float testThrottle, testSteer;
        public bool TestDrive, testHop;
        CharacterController body;
        float acceleration, vy, yaw, steer, springValue, springVelocity, crouch;
        bool reverseReady, hopQueued, airborne;
        float stoppedFor;
        Vector3 safe;
        Quaternion visualRest;
        Vector3 visualPosition;
        Transform wheel;
        public bool OnFoot { get; private set; }
        public float TouchThrottle,TouchSteer;
        public bool Boost;
        BloomWalk walk;
        public void SetWalking(bool value)
        {
            if(OnFoot==value)return;
            if(!walk)walk=gameObject.AddComponent<BloomWalk>();
            if(!walk.Change(value,visual))return;
            OnFoot=value;Speed=acceleration=Bank=0;Crashed=false;ClearInput();
        }
        public void Jump(){if(Active&&!Crashed)hopQueued=true;}

        void Awake()
        {
            body=GetComponent<CharacterController>();
            yaw=transform.eulerAngles.y*Mathf.Deg2Rad;
            safe=transform.position;
            if(visual) { visualRest=visual.localRotation;visualPosition=visual.localPosition;wheel=Find(visual,"Wheel_Pivot"); }
        }
        public static Transform Find(Transform root,string name)
        {
            foreach(var t in root.GetComponentsInChildren<Transform>(true))
                if(t.name==name) return t;
            return null;
        }
        public void ResetAt(Vector3 position, Quaternion heading)
        {
            body.enabled=false;transform.SetPositionAndRotation(position,heading);body.enabled=true;
            safe=position;Speed=acceleration=vy=steer=Bank=0;
            springValue=springVelocity=0;yaw=heading.eulerAngles.y*Mathf.Deg2Rad;
            Crashed=airborne=reverseReady=false;hopQueued=false;stoppedFor=0;
            if(visual)visual.localRotation=visualRest;
        }
        public void Remember(Vector3 point) { safe=point; }
        public void ClearInput() { hopQueued=false;testThrottle=testSteer=TouchThrottle=TouchSteer=0; }
        void Update()
        {
            if(!Active || Crashed) return;
            if(!TestDrive && Input.GetKeyDown(KeyCode.Space))hopQueued=true;
            if(TestDrive && testHop) { hopQueued=true;testHop=false; }
        }
        void FixedUpdate()
        {
            if(!Active || Crashed) return;
            float dt=Time.fixedDeltaTime;
            float throttle=TestDrive?testThrottle:(Input.GetKey(KeyCode.W)?1:Input.GetKey(KeyCode.S)?-1:0);
            float turn=TestDrive?testSteer:(Input.GetKey(KeyCode.D)?1:Input.GetKey(KeyCode.A)?-1:0);
            if(!TestDrive){if(Mathf.Abs(TouchThrottle)>.02f)throttle=TouchThrottle;if(Mathf.Abs(TouchSteer)>.02f)turn=TouchSteer;}
            if(OnFoot)
            {
                float target=throttle*(Boost||Input.GetKey(KeyCode.LeftShift)?5.8f:2.9f);
                Speed=Damp(Speed,target,10,dt);yaw+=turn*2.6f*dt;
                transform.rotation=Quaternion.Euler(0,yaw*Mathf.Rad2Deg,0);
                if(body.isGrounded){if(vy<0)vy=-1.5f;if(hopQueued){vy=3.5f;hopQueued=false;}}
                else vy-=9.81f*dt;
                Vector3 last=transform.position;body.Move((transform.forward*Speed+Vector3.up*vy)*dt);
                float travelled=Vector3.Distance(last,transform.position);Distance+=travelled;walk.Pose(travelled,Speed,visual);
                if(transform.position.y < -3)Recover();
                return;
            }
            bool brake=Input.GetKey(KeyCode.LeftControl)||throttle*Speed<-.2f;
            steer=Damp(steer,turn,6,dt);
            if(Mathf.Abs(Speed)<.22f)stoppedFor+=dt;else stoppedFor=0;
            if(throttle>=0)reverseReady=false;
            if(throttle<0 && stoppedFor>.35f)reverseReady=true;
            float request=0;
            if(throttle>0)request=7.6f;
            else if(throttle<0)request=reverseReady?-4.2f:-Mathf.Sign(Speed)*9.2f;
            else request=-Mathf.Sign(Speed)*Mathf.Min(Mathf.Abs(Speed)*1.4f,1.7f);
            if(brake && Mathf.Abs(Speed)>.15f)request=-Mathf.Sign(Speed)*9.2f;
            float jerk=brake?75:Mathf.Abs(request)<Mathf.Abs(acceleration)?32:22;
            acceleration+=Mathf.Clamp(request-acceleration,-jerk*dt,jerk*dt);
            float old=Speed;
            float limit=Boost||Input.GetKey(KeyCode.LeftShift)?21.8f:8.8f;
            Speed=Mathf.Clamp(Speed+acceleration*dt,-5.2f,limit);
            if(throttle==0 && old*Speed<0)Speed=acceleration=0;
            if(throttle<0 && !reverseReady && Speed<0)Speed=0;
            float yawRate=steer*Mathf.Lerp(2.55f,.62f,Mathf.Clamp01(Mathf.Abs(Speed)/21.8f));
            yaw+=yawRate*dt*Mathf.Clamp01(Mathf.Abs(Speed)/.6f)*Mathf.Sign(Speed);
            transform.rotation=Quaternion.Euler(0,yaw*Mathf.Rad2Deg,0);
            if(body.isGrounded)
            {
                if(airborne){Landings++;airborne=false;}
                if(vy<0)vy=-1.5f;
                if(hopQueued){vy=2.55f;Hops++;airborne=true;hopQueued=false;}
            }
            else {vy-=9.81f*dt;airborne=true;}
            Vector3 before=transform.position;
            body.Move((transform.forward*Speed+Vector3.up*vy)*dt);
            Distance+=Vector3.Distance(new Vector3(before.x,0,before.z),new Vector3(transform.position.x,0,transform.position.z));
            float desired=Mathf.Clamp(-Mathf.Atan(Speed*yawRate/9.81f)*.55f,-.65f,.65f);
            Bank=Spring(desired,7,dt);
            crouch=Damp(crouch,Input.GetKey(KeyCode.LeftControl)?1:0,7,dt);
            if(visual)
            {
                visual.localRotation=Quaternion.Euler(-acceleration*.75f,0,Bank*Mathf.Rad2Deg)*visualRest;
                var p=visualPosition;p.y+=-crouch*.10f+Mathf.Sin(Time.time*5.1f)*Mathf.Abs(Speed)*.0008f;visual.localPosition=p;
            }
            if(wheel)wheel.Rotate(Vector3.right,Speed/.255f*dt*Mathf.Rad2Deg,Space.Self);
            if(transform.position.y < -3)ResetAt(safe,Quaternion.Euler(0,yaw*Mathf.Rad2Deg,0));
        }
        public static float Damp(float value,float target,float rate,float dt)
            => target+(value-target)*Mathf.Exp(-rate*dt);
        float Spring(float target,float frequency,float dt)
        {
            float error=springValue-target,b=springVelocity+frequency*error,e=Mathf.Exp(-frequency*dt);
            springValue=target+(error+b*dt)*e;
            springVelocity=(springVelocity-frequency*b*dt)*e;
            return springValue;
        }
        void OnControllerColliderHit(ControllerColliderHit hit)
        {
            if(hit.normal.y>.6f)return;
            if(OnFoot)return;
            Contacts++;
            if(Mathf.Abs(Speed)>8.5f)
            {
                Crashed=true;Speed=0;
                if(visual)visual.localRotation=Quaternion.Euler(0,0,64)*visualRest;
            }
            else Speed*=.7f;
        }
        public void Recover() => ResetAt(safe,Quaternion.Euler(0,yaw*Mathf.Rad2Deg,0));
    }
}
