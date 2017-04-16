class Config{
  constructor(){
    // Initialize Firebase
    this.FIREBASE_CONFIG = {
      apiKey: "APIKEY",
      authDomain: "0000000.firebaseapp.com",
      databaseURL: "https://0000000.firebaseio.com",
      storageBucket: "00000.appspot.com",
      messagingSenderId: "00000"
    };

    //シグナリングの為のデータベース名
    this.FIREBASE_DB_WEBRTC_SIGNALING = "/webrtc/signaling";
  }
}

class WebRtcSignaling {
  constructor(userID,type,data){
    this.userID = userID;
    this.type = type;
    this.data = data;
  }

  toData(){
    return {
      "userID":this.userID,
      "eventType":this.eventType,
      "data":this.data
    };
  }
}

var config = new Config();
