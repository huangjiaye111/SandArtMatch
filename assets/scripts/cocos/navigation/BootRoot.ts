import { _decorator, Component } from "cc";
import { getRuntimeGameNavigator } from "./RuntimeGameServices";

const { ccclass } = _decorator;

@ccclass("BootRoot")
export class BootRoot extends Component {
  protected onLoad(): void {
    void getRuntimeGameNavigator().goHome();
  }
}
