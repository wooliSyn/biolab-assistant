// ==================== 隐私政策与服务条款 ====================
import { useState } from "react";
import { X, ShieldCheck, FileText } from "lucide-react";

const PRIVACY = [
  ["本地存储，数据不出设备", "本应用的全部数据（实验记录、方案、配方、数据集、打卡、便条、设置等）均以 JSON 文件形式保存在您本机的应用数据目录（Windows: %LOCALAPPDATA%\\biolab-assistant），不会上传到任何服务器。"],
  ["不收集个人信息", "我们不要求注册、不收集姓名手机号等身份信息，也不做用户行为追踪或广告画像。"],
  ["位置与天气（可选）", "为在页首显示当地天气，应用会尝试通过公开 IP 定位接口获取大致城市与坐标，并请求开放天气数据。该请求不携带任何账号信息；若您断开网络或拒绝授权，仅天气栏不显示，其余功能不受影响。"],
  ["实验附图的存储", "您在数据集中导入的图片附件会保存到本机 attachments 目录，点击时用系统默认查看器打开，绝不外传。"],
  ["外部链接", "「传送门」中的顶刊 / 图书馆入口点击后会在系统浏览器打开对应网站，届时将适用相应网站自身的隐私政策。"],
  ["数据由您掌控", "您可随时在「数据管理」中导出完整备份或清空全部本地数据；卸载应用即彻底删除所有数据。"],
];

const TERMS = [
  ["按「现状」提供", "本应用为科研辅助工具，按现状提供，不对特定实验结果的准确性、适用性作任何明示或暗示的保证。实验决策请以正式方案与安全规范为准。"],
  ["提醒仅供参考", "到点通知、倒计时、打卡激励等旨在辅助时间管理，可能受系统通知权限、休眠、后台限制等影响，请关键步骤自行复核。"],
  ["合理使用", "请勿将本应用用于任何违反法律法规或所在机构安全规定的用途。"],
  ["免责声明", "因设备故障、系统限制、误操作或不可抗力导致的数据丢失，开发者不承担直接损失责任；建议定期使用「数据管理」导出备份。"],
  ["版本与更新", `当前界面版本 v${__APP_VERSION__}（作者 YunPlover）。后续版本可能调整功能与条款，继续使用即视为接受。`],
];

export default function LegalDialog({ onClose }) {
  const [tab, setTab] = useState("privacy");
  const rows = tab === "privacy" ? PRIVACY : TERMS;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-gray-900/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden flex flex-col shadow-2xl" style={{ maxHeight: "80vh" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2 text-sm font-bold text-gray-800">
            <ShieldCheck size={16} className="text-indigo-500" />隐私政策与服务条款
          </div>
          <button onClick={onClose} className="p-1 rounded text-gray-300 hover:text-gray-600 hover:bg-gray-100"><X size={16} /></button>
        </div>
        <div className="flex gap-1 px-5 pt-3">
          {[["privacy", "隐私政策", ShieldCheck], ["terms", "服务条款", FileText]].map(([k, l, I]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-t-lg border-b-2 ${tab === k ? "text-indigo-600 border-indigo-500" : "text-gray-400 border-transparent hover:text-gray-600"}`}>
              <I size={13} />{l}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {rows.map(([t, b], i) => (
            <div key={i}>
              <div className="text-[12.5px] font-semibold text-gray-700 mb-0.5">{i + 1}. {t}</div>
              <div className="text-[11.5px] leading-relaxed text-gray-500">{b}</div>
            </div>
          ))}
          <div className="text-[10px] text-gray-300 pt-2 border-t border-gray-100">最后更新：2026-07 · BioLab 实验助手 v{__APP_VERSION__} · YunPlover</div>
        </div>
        <div className="px-5 py-3 border-t border-gray-100 text-right">
          <button onClick={onClose} className="px-4 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">我知道了</button>
        </div>
      </div>
    </div>
  );
}
