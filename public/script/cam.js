//cam.js
// AndroidからWebRTCで配信される映像,音声を処理するだけ
class Page{
  constructor(){
    console.log("constructor");
    //デバイス固有のID
    this.identifier = "Rb6LFUGK";

    const _this = this;
    this.WS_SERVER_PROTOCOL  = "wss";
    this.WS_SERVER_HOST_NAME = "localhost";
    this.WS_SERVER_HOST_PORT = "8090";

    //WebRTCユーテリティ
    this.rtcUtil = new RTCUtil();
    this.rtcUtil.setListener(this);

    // Initialize Firebase
    firebase.initializeApp(config.FIREBASE_CONFIG);
    //シグナリングイベントのリスナーを設定する
    this.initSignalingListener();

    //window.onload
    Rx.Observable.fromEvent(window, "load")
      .take(1)
      .subscribe(() => this.onload());
  }

  //初期化処理等を実行する
  onload(){
    console.log("onload");

    //各イベントを関連付ける
    Rx.Observable.fromEvent(u("#btnTest"), "click")
                  .subscribe(function(){
                      console.log(window.screen.height);
                      alert(window.screen.height);
                  });

    //ウィンドウサイズに合わせて動画表示領域を拡大
    const w = window.outerWidth;
    const h = window.outerHeight;
    u("#videoRemote").attr("width",w);
    u("#videoRemote").attr("height",h);
  }

  onWsOpen(){
    console.log("onWsOpen");
    //WS設定が完了したら オファー等の処理を開始する
    this.wsOffer();
  }

  onWsClose(){
    console.log("onWsClose");
  }

  onWsError(evt){
    console.log("onWsError");
    if (this.ws) {
        this.ws.close();
        this.ws = null;
    }
  }

  onWsMessage(evt){
    console.log("onWsMessage");
    const msg = JSON.parse(evt.data);
    console.log(msg);
    console.log("msg.type="+msg.type);
    switch (msg.type) {
      case "message":
        //alert(msg.data);
        console.error(msg.data);
        break;
      case "offer":
        console.log("msg.sdp="+msg.sdp);
        //RasPi側のSDPをリモートに送信
        this.sendSdp(this.rtcUtil.TYPE_OFFER,msg.sdp);
        break;
      case "geticecandidate":
        console.log("msg.data="+msg.data);
        const candidates = JSON.parse(msg.data);
        this.sendIceCandiDates(candidates);
        break;
    }
  }

  wsStop(){
    if (this.ws) {
        this.ws.close();
        this.ws = null;
    }
  }

  //通話終了
  hungUp(){
    this.wsStop();
  }

  //呼び出された時
  call(){
    this.wsStart();
  }

  //WS設定の開始
  wsStart(){
    const _this = this;

    if(this.ws == null){
      this.ws = new WebSocket(this.WS_SERVER_PROTOCOL+'://'+this.WS_SERVER_HOST_NAME+':'+this.WS_SERVER_HOST_PORT+'/stream/webrtc');
      Rx.Observable.fromEvent(this.ws, "open")
                    .subscribe(function(){
                        _this.onWsOpen();
                      });
      Rx.Observable.fromEvent(this.ws, "message")
                    .subscribe(function(evt){
                       _this.onWsMessage(evt);
                      });
      Rx.Observable.fromEvent(this.ws, "close")
                    .subscribe(function(){
                       _this.onWsClose();
                      });
      Rx.Observable.fromEvent(this.ws, "error")
                    .subscribe(function(evt){
                       _this.onWsError(evt);
                      });
    }
    else{
      //WS設定が完了済みなので オファー等の処理を開始する
      this.wsOffer();
    }
  }

  //オファーを送る
  wsOffer() {
      this.rtcUtil.createPeerConnection();
      var command = {
          command_id: "offer",
          options: {
              force_hw_vcodec: true,
              vformat: "60"
          }
      };
      this.wsSend(command);
      console.log("offer(), command=" + JSON.stringify(command));
  }

  //WSでコマンドを送信する
  wsSend(command){
    console.log("wsSend");
    if(this.ws == null){
      console.log("　ws is null");
      return;
    }
    console.log("　ws.readyState "+this.ws.readyState);
    //readyState 1 OPEN
    if(this.ws.readyState != 1){
      return;
    }
    this.ws.send(JSON.stringify(command));
  }

  //シグナリングイベントのリスナーを設定する
  initSignalingListener(){
    const _this = this;
    this.webRtcSignalingAll = firebase.database().ref(config.FIREBASE_DB_WEBRTC_SIGNALING+"/"+this.identifier);
    //DB内容が変更されたとき実行される
    Rx.Observable.fromEvent(this.webRtcSignalingAll, "value")
                  .subscribe(function(snapshot){
                      const evt = snapshot.val();
                      console.log("evt "+evt);
                      //ユーザーIDをチェックして自分以外だった時だけ以下の処理を実行
                      if((evt == null)||(_this.identifier == evt.identifier)){
                          return;
                      }
                      if (evt.type === _this.rtcUtil.TYPE_OFFER) {
                        //offer SDPを受信したので offerを設定
                        _this.rtcUtil.setOffer(evt.data.sdp);
                      }
                      else if (evt.type === _this.rtcUtil.TYPE_ANSWER) {
                        //answer SDPを受信したので answer を設定
                        //_this.rtcUtil.setAnswer(evt.data.sdp);

                        let sessionDescription = new RTCSessionDescription({
                          type : 'answer',
                          sdp : evt.data.sdp,
                        });
                        var command = {
                            command_id: "answer",
                            data: JSON.stringify(sessionDescription)
                        };
                        _this.wsSend(command);
                      }
                      else if (evt.type === _this.rtcUtil.TYPE_CANDI_DATE) {
                        //wsで受け取ったicecandidateを設定する
                        if(_this.rtcUtil.peerConnection){
                          const date = JSON.parse(evt.data.icecandidate);
                          const candidate = {
                              sdpMLineIndex: date.sdpMLineIndex,
                              sdpMid: date.sdpMid,
                              candidate: date.candidate
                          };
                          const command = {command_id: "addicecandidate",data:JSON.stringify(candidate)};
                          _this.wsSend(command);
                        }
                      }
                      else if (evt.type === _this.rtcUtil.TYPE_REMOTE_CALL) {
                        //Android側から RasPi のカメラへ繋ぐ
                        _this.wsStart();
                      }
                      else if (evt.type === _this.rtcUtil.TYPE_REMOTE_HUNG_UP) {
                        //Android側から RasPi のカメラへの接続を中断
                        _this.wsStop();
                      }
                  });
  }

  onRemoteStreamAdded(stream){
    console.log("onRemoteStreamAdded");
    u("#videoRemote").attr("src",windowURL.createObjectURL(stream));
  }

  onRemoteStreamRemoved(){
    console.log("onRemoteStreamRemoved");
    u("#videoRemote").attr("src","");
  }

  sendSdp(type,sdp){
    console.log("sendSdp");
    console.log("type="+type);
    console.log(sdp);
    const webRtcSignaling = new WebRtcSignaling(this.identifier,type,{"sdp":sdp});
    this.webRtcSignalingAll.set(webRtcSignaling);
  }

  sendIceCandiDates(iceCandiDates){
    console.log("sendIceCandiDates");
    const webRtcSignaling = new WebRtcSignaling(this.identifier,this.rtcUtil.TYPE_CANDI_DATES,{"icecandidates":iceCandiDates});
    this.webRtcSignalingAll.set(webRtcSignaling);
  }

  //WebRtc リスナー
  onSendIceCandiDate(icecandidate){
    console.log("onSendIceCandiDate");
    console.log(icecandidate);
  }

  onSendSdp(type,sdp){
    console.log("onSendSdp");
    this.sendSdp(type,sdp);
  }
}

var page = new Page();
