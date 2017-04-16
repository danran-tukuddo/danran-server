//webrtc.js

//関数定義
navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
const windowURL = window.URL || window.webkitURL;
const RTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection || window.mozRTCPeerConnection;
const RTCSessionDescription = window.RTCSessionDescription || window.webkitRTCSessionDescription || window.mozRTCSessionDescription;
const RTCIceCandidate = window.RTCIceCandidate || window.webkitRTCIceCandidate || window.mozRTCIceCandidate;

class RTCUtil {
  //コンストラクタ
  constructor(){
    console.log("constructor");
    this.TYPE_OFFER = "offer";
    this.TYPE_ANSWER = "answer";
    this.TYPE_CANDI_DATES = "candidates";
    this.TYPE_CANDI_DATE = "candidate";
    this.TYPE_REMOTE_CALL = "remote_call";
    this.TYPE_REMOTE_HUNG_UP = "remote_hung_up";

    this.sendSdpType = null;

    this.mediaConstraints = {
      'mandatory': {
        'OfferToReceiveAudio': true,
        'OfferToReceiveVideo': true
      }
    };
    this.ice_config = {"iceServers": [
         {"urls": ["stun:stun.l.google.com:19302","stun:192.168.10.9:3478"]}
    ]};

    this.pc_options = {
      optional: [
        // Deprecated:
        //{RtpDataChannels: false},
        //{DtlsSrtpKeyAgreement: true}
      ]
    };

    this.peerConnection = null;
    this.streamLocal = null;

    this.listener = null;
  }

  //イベントリスナー
  setListener(listener){
    this.listener = listener;
  }

  //getUserMediaを取得する
  getDeviceStream(option) {
    if ('getUserMedia' in navigator.mediaDevices) {
      console.log('navigator.mediaDevices.getUserMadia');
      return navigator.mediaDevices.getUserMedia(option);
    }
    else {
      console.log('wrap navigator.getUserMadia with Promise');
      return new Promise(function(resolve, reject){
        navigator.getUserMedia(option,
          resolve,
          reject
        );
      });
    }
  }

  ringIn(streamLocal){
    this.streamLocal = streamLocal;
    this.makeOffer();
  }

  ringUp(){
      Rx.Observable.of(this.peerConnection)
          .subscribe(function(connection){
            console.log("close");
            connection.close();
          });
  }

  createPeerConnection(){
    console.log("createPeerConnection");
    this.peerConnection = this.prepareNewConnection();
  }

  makeOffer(){
    const _this = this;
    this.sendSdpType = this.TYPE_OFFER;
    this.createPeerConnection();
    if(this.streamLocal){
      this.peerConnection.createOffer()
            .then(function (sessionDescription) {
              console.log('createOffer() succsess in promise');
              return _this.peerConnection.setLocalDescription(sessionDescription);
            }).then(function() {
              console.log('setLocalDescription() succsess in promise');
            }).catch(function(err) {
              console.error(err);
            });
     }
  }

  prepareNewConnection() {
    const _this = this;
    const peer = new RTCPeerConnection(this.ice_config,this.pc_options);
    console.log(peer);

    if ('ontrack' in peer) {
      Rx.Observable.fromEvent(peer,"track")
                    .subscribe(function(event){
                      console.log('-- peer.ontrack()');
                      if(_this.listener == null){
                        console.log('this.listener is null.');
                        return;
                      }
                      _this.listener.onRemoteVideoStream(event.streams[0]);
                    });
    }
    else{
      Rx.Observable.fromEvent(peer,"addstream")
                    .subscribe(function(event){
                      console.log('-- peer.onaddstream()');
                      if(_this.listener == null){
                        console.log('this.listener is null.');
                        return;
                      }
                      _this.listener.onRemoteVideoStream(event.stream);
                    });
    }


    Rx.Observable.fromEvent(peer,"icecandidate")
                  .subscribe(function(event){
                    // Trickle ICE の場合は、ICE candidateを相手に送る
                    _this.onSendIceCandiDate(event.candidate);
                    Rx.Observable.of(event.candidate)
                      .filter(x => x === null)
                      .subscribe(function(){
                                  console.log('empty ice event');
                                  //console.log(peer.localDescription);
                                  // Trickle ICE の場合は、何もしない
                                  // Vanilla ICE の場合には、ICE candidateを含んだSDPを相手に送る
                                  _this.sendSdp(_this.sendSdpType,peer.localDescription);
                                });
                  });

    if(this.streamLocal){
      Rx.Observable.of(this.streamLocal)
          .filter(x => x !== null)
          .subscribe(function(stream){
            console.log('Adding local stream...');
            peer.addStream(stream);
          });
    }

    return peer;
  }

  onSendIceCandiDate(candidate){
    console.log("onSendIceCandiDate");
    console.log(candidate);
    if(candidate){
      if(this.listener == null) return;
      this.listener.onSendIceCandiDate(candidate);
    }
  }

  //Session Description Protocol (SDP)
  sendSdp(type,sessionDescription) {
    if(this.listener == null) return;
    this.listener.onSendSdp(type,sessionDescription.sdp);
  }

  setOffer(sdp){
    console.log("setOffer");
    console.log(sdp);
    const _this = this;
    const offer = new RTCSessionDescription({
      type : 'offer',
      sdp : sdp,
    });

    this.createPeerConnection();
    Rx.Observable.of(this.peerConnection)
    .subscribe(function(connection){
          connection.setRemoteDescription(offer)
          .then(function() {
            console.log('setRemoteDescription(offer) succsess in promise');
            //回答を作成して送信
            _this.makeAnswer();
          }).catch(function(err) {
            console.error('setRemoteDescription(offer) ERROR: ', err);
          });
    });
  }

  makeAnswer(){
    console.log("makeAnswer");
    const _this = this;
    this.sendSdpType = this.TYPE_ANSWER;
    this.peerConnection.createAnswer(this.mediaConstraints)
      .then(function (sessionDescription) {
        console.log('createAnswer() succsess in promise');
        return _this.peerConnection.setLocalDescription(sessionDescription);
      }).then(function() {
        console.log('setLocalDescription() succsess in promise');
        // -- Trickle ICE の場合は、初期SDPを相手に送る --
        // -- Vanilla ICE の場合には、まだSDPは送らない --
        _this.sendSdp(_this.sendSdpType,_this.peerConnection.localDescription);
      }).catch(function(err) {
        console.error(err);
      });
  }

  setAnswer(sdp){
    console.log("setAnswer");
    console.log(sdp);
    const _this = this;
    let answer = new RTCSessionDescription({
      type : 'answer',
      sdp : sdp,
    });
    console.log("peerConnection "+this.peerConnection);

    Rx.Observable.of(this.peerConnection)
        .filter(x => x !== null)
        .subscribe(function(connection){
          connection.setRemoteDescription(answer)
            .then(function() {
              console.log('setRemoteDescription(answer) succsess in promise');
            }).catch(function(err) {
              console.error('setRemoteDescription(answer) ERROR: ', err);
            });
        });
  }

  setIceCandiDates(icecandidates){
    if(this.peerConnection == null)return;

    for (var i = 0; icecandidates && i < icecandidates.length; i++) {
        var elt = icecandidates[i];
        let candidate = new RTCIceCandidate({sdpMLineIndex: elt.sdpMLineIndex, candidate: elt.candidate});
        this.peerConnection.addIceCandidate(candidate,
            function () {
                console.log("IceCandidate added: " + JSON.stringify(candidate));
            },
            function (error) {
                console.log("addIceCandidate error: " + error);
            }
        );
    }
  }
}
