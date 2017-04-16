//index.js

class Page{
  static version(){ return "0.1"; }

  //コンストラクタ
  constructor(){
    console.log("constructor");

    //window.onload
    Rx.Observable.fromEvent(window, "load")
      .take(1)
      .subscribe(() => this.onload());
  }

  //初期化処理等を実行する
  onload(){
    console.log("onload");
  }

  /*
  set name(name) {
    this._name = name;
  }
  get name() {
    return this._name;
  }
  */
}

var page = new Page();
