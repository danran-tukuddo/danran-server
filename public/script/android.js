//index.js

class Page{
  static version(){ return "0.1"; }

  //コンストラクタ
  constructor(){
    console.log("constructor");
    this.userID = "V5pyf8h4";
    //接続先デバイスコード
    this.deviceCode = "Rb6LFUGK";

    //ローカルデバイスのユーザーメディアストリーム
    this.streamLocal = null;

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

  //シグナリングイベントのリスナーを設定する
  initSignalingListener(){
    const _this = this;
    this.webRtcSignalingAll = firebase.database().ref(config.FIREBASE_DB_WEBRTC_SIGNALING+"/"+this.deviceCode);
    //DB内容が変更されたとき実行される
    Rx.Observable.fromEvent(this.webRtcSignalingAll, "value")
                  .subscribe(function(snapshot){
                      const evt = snapshot.val();
                      console.log("evt "+evt);
                      //ユーザーIDをチェックして自分以外だった時だけ以下の処理を実行
                      if((evt == null)||(_this.userID == evt.userID)){
                          return;
                      }

                      if (evt.type === _this.rtcUtil.TYPE_ANSWER) {
                        //answer SDPを受信した
                        _this.rtcUtil.setAnswer(evt.data.sdp);
                      }
                      else if (evt.type === _this.rtcUtil.TYPE_OFFER) {
                        //offer SDPを受信した
                        _this.rtcUtil.setOffer(evt.data.sdp);
                      }
                      else if (evt.type === _this.rtcUtil.TYPE_CANDI_DATES) {
                        //candiDates一覧を受信した
                        _this.rtcUtil.setIceCandiDates(evt.data.icecandidates);
                      }
                  });
  }

  //初期化処理等を実行する
  onload(){
    console.log("onload");

    //各イベントを関連付ける
    Rx.Observable.fromEvent(u("#btnVideoLocalStart"), "click")
                  .subscribe(() => this.startVideoLocal());
    Rx.Observable.fromEvent(u("#btnVideoLocalStop"), "click")
                  .subscribe(() => this.stopVideoLocal());
    Rx.Observable.fromEvent(u("#btnCallStart"), "click")
                  .subscribe(() => this.startVideoRemote());
    Rx.Observable.fromEvent(u("#btnHungUpStop"), "click")
                  .subscribe(() => this.stopVideoRemote());
  }

  show(id){
    u(id).removeClass('hidden').addClass('visible');
  }
  hide(id){
    u(id).removeClass('visible').addClass('hidden');
  }
  //ビデオ開始
  startVideoLocal(){
    console.log("startVideoLocal");
    const _this = this;
    //const videoLocal = u("#videoLocal");

    Rx.Observable.of(this.rtcUtil.getDeviceStream({video: true, audio: true}))
                  .subscribe(function(userMedia){
                      console.log("userMedia "+userMedia);
                      //表示非表示切り替え
                      _this.hide("#btnVideoLocalStart");
                      _this.show("#btnVideoLocalStop");

                      // success
                      userMedia.then(function (stream) {
                          console.log(" success "+stream);
                          // success
                          //videoLocal.attr("src",window.URL.createObjectURL(stream));
                          _this.streamLocal = stream;

                          //リモートへ接続
                          _this.rtcUtil.ringIn(_this.streamLocal);

                          //リモートの画像を取得
                          _this.startVideoRemote();
                        })
                      .catch(function (error) {
                        // error
                        console.error('mediaDevice.getUserMedia() error:', error);
                      });
                    },
                    function (error) {
                      // error
                      console.error('mediaDevice.getUserMedia() error:', error);
                    });
  }

  //ビデオ停止
  stopVideoLocal(){
    console.log("stopVideoLocal");
    Rx.Observable.from(this.streamLocal.getTracks())
                .subscribe((track) => track.stop());
    //リモートから切断
    this.rtcUtil.ringUp();

    //リモートの画像を取得を停止
    this.stopVideoRemote();

    //表示非表示切り替え
    this.show("#btnVideoLocalStart");
    this.hide("#btnVideoLocalStop");
  }

  //リモートのカメラ画像を取得する
  startVideoRemote(){
    console.log("startVideoRemote");
    const webRtcSignaling = new WebRtcSignaling(this.userID,this.rtcUtil.TYPE_REMOTE_CALL,{});
    this.webRtcSignalingAll.set(webRtcSignaling);
  }

  //リモートのカメラ画像を停止する
  stopVideoRemote(){
    console.log("stopVideoRemote");
    const webRtcSignaling = new WebRtcSignaling(this.userID,this.rtcUtil.TYPE_REMOTE_HUNG_UP,{});
    this.webRtcSignalingAll.set(webRtcSignaling);
  }

  onRemoteStreamAdded(stream){
    console.log("onRemoteStreamAdded");
    u("#videoRemote").attr("src",windowURL.createObjectURL(stream));
  }

  onRemoteStreamRemoved(){
    console.log("onRemoteStreamRemoved");
    u("#videoRemote").attr("src","");
  }

  //WebRtc リスナー

  //candidateをシグナリングの為に送信
  onSendIceCandiDate(icecandidate){
    console.log("onSendIceCandiDate");
    console.log(icecandidate);

    const webRtcSignaling = new WebRtcSignaling(this.userID,this.rtcUtil.TYPE_CANDI_DATE,{"icecandidate":JSON.stringify(icecandidate)});
    this.webRtcSignalingAll.set(webRtcSignaling);
  }

  //SDPをシグナリングの為に送信
  onSendSdp(type,sdp){
    console.log("onSendSdp");
    console.log("type="+type);
    console.log(sdp);
    const webRtcSignaling = new WebRtcSignaling(this.userID,type,{"sdp":sdp});
    this.webRtcSignalingAll.set(webRtcSignaling);
  }
}

var page = new Page();
