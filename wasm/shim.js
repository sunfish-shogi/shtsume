// ShogiHome WebAssembly engine ABI (shogihome-wasm-engine/1) adapter.
// Emscripten の --pre-js で読み込まれ、モジュールに
// postMessage / addMessageListener / removeMessageListener / terminate を追加する。
//
// エンジンのメインイベントループは探索用の pthread で動くため、
// usi_command を呼ぶだけで思考は自力で進む (usi_poll によるポーリングは不要)。
var shtsumeMessageListeners = new Set();
var shtsumeQuit = false;
var shtsumeOriginalPrint = Module["print"];

Module["print"] = function (line) {
  // quit / terminate() の後は何も出力しない。
  if (shtsumeQuit) {
    return;
  }
  var text = String(line);
  // エンジンは "usiok\n" のように改行付きの文字列を puts するため空行が混じる。
  // 空行は USI として意味を持たないので捨てる。
  if (text.trim() === "") {
    return;
  }
  shtsumeMessageListeners.forEach(function (listener) {
    listener(text);
  });
  if (shtsumeOriginalPrint) {
    shtsumeOriginalPrint(text);
  }
};

Module["postMessage"] = function (command) {
  if (shtsumeQuit) {
    return;
  }
  var line = String(command);
  if (line.trim() === "quit") {
    shtsumeQuit = true;
  }
  Module["ccall"]("usi_command", null, ["string"], [line]);
};

Module["addMessageListener"] = function (listener) {
  shtsumeMessageListeners.add(listener);
};

Module["removeMessageListener"] = function (listener) {
  shtsumeMessageListeners.delete(listener);
};

Module["terminate"] = function () {
  Module["postMessage"]("quit");
  shtsumeMessageListeners.clear();
};
