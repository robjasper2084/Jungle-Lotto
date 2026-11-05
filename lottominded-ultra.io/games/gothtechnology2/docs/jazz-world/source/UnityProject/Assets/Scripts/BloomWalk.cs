using System.Collections.Generic;
using UnityEngine;
namespace DigitalStatic.Bloom
{
    // The original Swoop skeleton, with distance-driven alternating steps and arm swing.
    public sealed class BloomWalk : MonoBehaviour
    {
        readonly Dictionary<Transform,Quaternion> rest=new Dictionary<Transform,Quaternion>();
        Transform vehicle,parked,hip,leftFoot,rightFoot;
        Vector3 visualRest;Quaternion visualRotation;
        float phase;
        Transform Bone(Transform root,string name)=>BloomRide.Find(root,name);
        public bool Change(bool walking,Transform visual)
        {
            if(rest.Count==0)
            {
                visualRest=visual.localPosition;visualRotation=visual.localRotation;
                vehicle=Bone(visual,"EUC_ROOT");hip=Bone(visual,"Hips");leftFoot=Bone(visual,"LeftFoot");rightFoot=Bone(visual,"RightFoot");
                foreach(string name in new[]{"LeftUpLeg","RightUpLeg","LeftLeg","RightLeg","LeftArm","RightArm","LeftForeArm","RightForeArm","Spine","Spine1"})
                {var bone=Bone(visual,name);if(bone)rest[bone]=bone.localRotation;}
            }
            if(walking)
            {
                if(vehicle){parked=Instantiate(vehicle,vehicle.position,vehicle.rotation);parked.name="Parked Bloom wheel";parked.localScale=vehicle.lossyScale;vehicle.gameObject.SetActive(false);}
                visual.localRotation=visualRotation;
                // Lower the rider from the EUC pedals onto the same collision floor.
                visual.localPosition=visualRest;
                float feet=leftFoot&&rightFoot?Mathf.Min(leftFoot.position.y,rightFoot.position.y)-transform.position.y:.28f;
                visual.position-=Vector3.up*Mathf.Max(0,feet-.075f);
                phase=0;
            }
            else
            {
                if(parked&&Vector3.Distance(transform.position,parked.position)>3)return false;
                if(parked)Destroy(parked.gameObject);if(vehicle)vehicle.gameObject.SetActive(true);
                foreach(var pair in rest)pair.Key.localRotation=pair.Value;
                visual.localPosition=visualRest;visual.localRotation=visualRotation;
            }
            return true;
        }
        public float WheelDistance=>parked?Vector3.Distance(transform.position,parked.position):0;
        void Swing(Transform root,string name,float degrees,Vector3 axis)
        {
            var bone=Bone(root,name);if(!bone||!rest.ContainsKey(bone))return;
            bone.localRotation=rest[bone];
            bone.rotation=Quaternion.AngleAxis(degrees,axis)*bone.rotation;
        }
        public void Pose(float distance,float speed,Transform visual)
        {
            phase+=distance*5.4f;float move=Mathf.Clamp01(Mathf.Abs(speed)/1.5f),stride=Mathf.Sin(phase)*move;
            foreach(var pair in rest)pair.Key.localRotation=pair.Value;
            Swing(visual,"LeftUpLeg",stride*29,transform.right);Swing(visual,"RightUpLeg",-stride*29,transform.right);
            Swing(visual,"LeftLeg",Mathf.Max(0,-stride)*33,transform.right);Swing(visual,"RightLeg",Mathf.Max(0,stride)*33,transform.right);
            Swing(visual,"LeftArm",-stride*18,transform.right);Swing(visual,"RightArm",stride*18,transform.right);
            Swing(visual,"LeftForeArm",-12-Mathf.Abs(stride)*8,transform.right);Swing(visual,"RightForeArm",-12-Mathf.Abs(stride)*8,transform.right);
        }
        void OnDestroy(){if(parked)Destroy(parked.gameObject);}
    }
}
