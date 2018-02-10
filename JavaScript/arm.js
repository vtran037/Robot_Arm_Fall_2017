var five = require("johnny-five");
var Leap = require('leapjs');

//Arduino Pins
var base_pin = 3;
var shoulder_pin=5;
var elbow_pin=6;
var pitch_pin = 9;
var roll_pin = 10;
var claw_pin = 11;

//Servo Positions
var base_pos;
var shoulder_pos;
var elbow_pos;
var pitch_pos;
var roll_pos;
var claw_pos;
var test_pos;

//Angle variables
var L_arm_length = 120;
var U_arm_length = 130;
var hypotenuse = 0.0;
var armAngles;

//For Averaging
var xAvg;
var yAvg;
var zAvg;
var armAngles;


var controller = new Leap.Controller();
controller.on('connect', function(frame) {
              console.log("Successfully connected");
              });
controller.on('frame',function(frame)
              {
              if(frame.hands.length > 0)
              {
              //y - 0
              //offset y
              frame.hands[0].palmPosition[1] -= 85//65;
              console.log("y:"+frame.hands[0].palmPosition[1]);
              
              //z - 2
              //offset z
              frame.hands[0].palmPosition[2] = (-1*frame.hands[0].palmPosition[2]) + 120;
              console.log("z: "+frame.hands[0].palmPosition[2]);
              
              xAvg = avgQueue(frame.hands[0].palmPosition[0]);
              yAvg = avgQueue(frame.hands[0].palmPosition[1]);
              zAvg = avgQueue(frame.hands[0].palmPosition[2]);
              
              armAngles = findAngles(yAvg,zAvg);
              
              //x - 0
              //moves the base
              //180/pi = conver to degrees
              //+90 offset for Range (0-180), otherwise only from (0-90)
              base_pos = (Math.atan(xAvg/zAvg)) * (180/Math.PI) + 80;
              console.log("x:"+frame.hands[0].palmPosition[0]);
              
          
              
              //pitch raise/lower
              //fromlow, from high, tolow, to high
              pitch_pos = (frame.hands[0].pitch()) * (180/Math.PI) + 90;
              
              
              //pitch twist
              roll_pos = (frame.hands[0].roll()) * (180/Math.PI) + 120;
              
              shoulder_pos = armAngles.base_angle;
              
              elbow_pos = armAngles.top_angle;
           
              
              
              //console.log("pitch degrees:"+wristAngle);
              }
              
              if(frame.hands.length <= 0)
              {
              base_pos = 90;
              shoulder_pos = 120;
              elbow_pos = 130;
              pitch_pos = 130;
              roll_pos = 105;
              claw_pos = 10;
              
              }
              
              
              if(frame.pointables.length > 1)
              {
              var thumb = frame.pointables[0];
              var index = frame.pointables[1];
              var middle = frame.pointables[2];
              var ring = frame.pointables[3];
              var pinky = frame.pointables[4];
              
              xfingerDistance = distanceFormula(thumb.tipPosition[0], ring.tipPosition[0]);
              
              yfingerDistance = distanceFormula(thumb.tipPosition[1], ring.tipPosition[1]);
              
              zfingerDistance = distanceFormula(thumb.tipPosition[2], index.tipPosition[2]);
              
              console.log("xfingerDistance:"+xfingerDistance);
              console.log("yfingerDistance:"+yfingerDistance);
              console.log("zfingerDistance:"+zfingerDistance);
              
              // IF Thumb & Index doesnt work, try Thumb and pinky
              test_pos = xfingerDistance * 2 + yfingerDistance * 2;
              test_pos =five.Fn.map(test_pos,180,-180, 0,360) + 70;
              console.log("test_pos:"+test_pos);
              
              
              }
              
              });


controller.connect();

var base;
var shoulder;
var elbow;
var pitch;
var roll;
var claw;

board = new five.Board();
board.on("ready", function() {
         
         base= new five.Servo(base_pin);
         shoulder = new five.Servo(shoulder_pin);
         elbow= new five.Servo(elbow_pin);
         pitch = new five.Servo(pitch_pin);
         roll = new five.Servo(roll_pin);
         claw = new five.Servo(claw_pin);
         
         this.loop(20, function(){
                   if(base_pos >= 0 && base_pos <= 180){
                   base.to(base_pos);
                   }
                   if(!isNaN(shoulder_pos) && !isNaN(elbow_pos)) {
                   shoulder.to(shoulder_pos);
                   elbow.to(elbow_pos);
                   }
                   if(pitch_pos >= 0 && pitch_pos <= 180){
                   pitch.to(pitch_pos);
                   }
                   
                   if(roll_pos >= 0 && roll_pos <= 180){
                   roll.to(roll_pos);
                   }
                   if(test_pos >= 0 && test_pos <=180){
                   claw.to(test_pos);
                   }
                   });
         });

function findAngles(y,z) {
    
    hypotenuse = Math.sqrt(square(y)+square(z));
    
    //atan2 takes care of both positive and negative cases
    L_base_angle = Math.atan2(y, z);
    U_base_angle = Math.acos((square(hypotenuse) + square(L_arm_length) - square(U_arm_length)) / (2 * hypotenuse * U_arm_length));
    
    // Shoulder angle
    var base_angle = (L_base_angle+ U_base_angle) * (180/Math.PI);
    console.log("base_angle: "+base_angle);
    
    // Elbow angle
    var other_angle = Math.acos((square(L_arm_length) + square(U_arm_length) - square(hypotenuse)) / (2 * L_arm_length * U_arm_length));
    
    var top_angle = 180 - (other_angle * (180/Math.PI));
    console.log("top_angle: "+top_angle);
    
    return {
    base_angle: base_angle,
    top_angle: top_angle
    }
}

function avgQueue(position) {
    var sum = 0;
    for(var i = 0; i < 3; i++) {
        sum += position;
    }
    return (sum / 3);
}


function distanceFormula(x,y){
    return Math.sqrt(square(x-y));
}

function square(x) {
    return x*x;
}



function handStateFromHistory(hand, historySamples) {
    if(hand.grabStrength == 1) return "closed";
    else if (hand.grabStrength == 0) return "open";
    else {
        var sum = 0
        for(var s = 0; s < historySamples; s++){
            var oldHand = controller.frame(s).hand(hand.id)
            if(!oldHand.valid) break;
            sum += oldHand.grabStrength
        }
        var avg = sum/s;
        if(hand.grabStrength - avg < 0) return "opening";
        else if (hand.grabStrength > 0) return "closing";
    }
    return"not detected";
}

//console.log("Hand is " + handStateFromHistory(hand, 10));



