//
//  exports.c
//  shtsume
//
//  WebAssembly 版のエントリポイント。
//  ShogiHome の WebAssembly エンジン ABI (shogihome-wasm-engine/1) に従い、
//  shim.js から呼び出される usi_command をエクスポートする。
//
//  ネイティブ版では受信専用スレッドが標準入力からコマンドを読み、
//  メインスレッドがメインイベントループを回す。WebAssembly 版では
//  標準入力が使えないため、次のように役割を置き換える。
//    ・受信専用スレッド     -> usi_command (Worker のメインスレッドから呼ばれる)
//    ・メインイベントループ -> 探索用の pthread
//

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <pthread.h>
#include <emscripten/emscripten.h>
#include "shogi.h"
#include "usi.h"
#include "shtsume.h"

//探索用スレッドのスタックサイズ（詰探索は再帰が深いため大きめに確保する）
#define ENGINE_STACK_SIZE (8*1024*1024)

static bool st_started = false;

static void *engine_thread(void *arg){
    usi_event_loop();
    return NULL;
}

static bool start_engine(void){
    //基本ライブラリの初期化処理（nmain.c の USI モードと同じ）
    g_commandline   = false;
    g_info_interval = 1;
    g_pv_length     = 20;
    create_seed();                        //zkey
    init_distance();                      //g_distance
    init_bpos();                          //bitboard
    init_effect();                        //effect
    srand((unsigned)time(NULL));
    usi_init();

    //メインイベントループを探索用スレッドで稼働
    pthread_attr_t attr;
    pthread_attr_init(&attr);
    pthread_attr_setstacksize(&attr, ENGINE_STACK_SIZE);
    pthread_t thread;
    int err = pthread_create(&thread, &attr, engine_thread, NULL);
    pthread_attr_destroy(&attr);
    if(err){
        printf("info string failed to begin thread. %s %d\n",
               __FILE__, __LINE__);
        return false;
    }
    pthread_detach(thread);
    return true;
}

/* ---------------------------------------------------------------------------
 usi_command
 USIコマンドを1行受け取る。
 [引数]
 line : USIコマンド（末尾の改行は無くてよい）
 --------------------------------------------------------------------------- */
EMSCRIPTEN_KEEPALIVE void usi_command(const char *line){
    if(!st_started){
        st_started = true;
        if(!start_engine()) return;
    }
    //ネイティブ版の受信専用スレッドと同様に、末尾を空白にして渡す
    char buf[SZ_USIBUFFER];
    snprintf(buf, sizeof(buf), "%s ", line ? line : "");
    usi_receive(buf);
}
