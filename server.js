// server.js

// 必要なライブラリを読み込む
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
// Socket.IOサーバーをHTTPサーバーに接続
const io = socketIo(server);

// --- サーバー側のゲーム状態を定義 ---
let gameState = {
    currentWinner: null, // 現在コンボを主導している四天王
    currentCount: 0,     // 現在のコンボ数
    scores: { toriko: 0, sunny: 0, coco: 0, zebra: 0 },
    winConditions: { toriko: 5, sunny: 3, coco: 3, zebra: 3 },
    names: { komatsu: '小松', toriko: 'トリコ', sunny: 'サニー', coco: 'ココ', zebra: 'ゼブラ' },
    isGameOver: false,
    lastSpeaker: null // ★追加：直前に押した人を追跡するために使用
};
// ------------------------------------

// クライアント（ブラウザ）からアクセスがあったときにindex.htmlを返す設定
app.use(express.static('public')); 
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// Socket.IO接続イベントの処理
io.on('connection', (socket) => {
    console.log('新しいプレイヤーが接続しました:', socket.id);

    socket.emit('update_game_state', gameState);

    // ★クライアントからのボタン操作イベントを受け取る★
    socket.on('player_action', (data) => {
        const speaker = data.speaker;
        console.log(`[${speaker}] ボタンが押されました`);

        // --- サーバー上でゲームロジックを実行 ---
        if (speaker === 'komatsu') { 
             // 小松が押したら、コンボ状態を完全にリセットする
             resetGame(); 
        } else { 
            // 四天王の操作
            checkWin(speaker); 
        }
        
        // 誰が押したかを最後に記録する (checkWinの後の判定に使うため)
        gameState.lastSpeaker = speaker;
        // ----------------------------------------
        
        io.emit('new_action', data); 
        io.emit('update_game_state', gameState); 

        // ゲーム終了後の自動リセット
        if (gameState.isGameOver) {
             console.log(`ゲーム終了！勝利者: ${gameState.currentWinner}`);
             setTimeout(() => {
                 resetComboStateOnly(); 
                 io.emit('update_game_state', gameState); 
             }, 3000); 
        }
    });

    socket.on('disconnect', () => {
        console.log('プレイヤーが切断しました:', socket.id);
    });
});

// --- サーバー側のゲームロジック ---

// 小松が押したときの関数（コンボをリセットする役割）
function resetGame() {
    // 状態を完全に初期値に戻す（小松が押すことでコンボが中断される）
    gameState.currentWinner = null; 
    gameState.currentCount = 0;     
    gameState.isGameOver = false;
    console.log("小松が押しました。コンボ状態をリセットし、新しいコンボの準備ができました。");
}

// ゲームオーバー後の初期化（スコアは維持）
function resetComboStateOnly() {
    gameState.currentWinner = null;
    gameState.currentCount = 0;
    gameState.isGameOver = false;
    gameState.lastSpeaker = null; 
    console.log("ゲームオーバー後の状態をリセットしました。");
}

function checkWin(currentSpeaker) {
    const winGoal = gameState.winConditions[currentSpeaker];
    const previousWinner = gameState.currentWinner; 
    const previousSpeaker = gameState.lastSpeaker; // 最後のボタンを押した人

    // 1. コンボをリセットすべき条件をチェック
    if (previousSpeaker === 'komatsu' || previousWinner === null) {
        // (A) 直前が小松、または最初の押しの場合
        //    -> 新しいコンボをトリコ/ココ/サニー/ゼブラで開始する
        gameState.currentWinner = currentSpeaker;
        gameState.currentCount = 1;

    } else if (previousWinner === currentSpeaker) {
        // (B) 同じ四天王が連続で押した場合（コンボ継続）
        //    -> 小松の介入は不要で、コンボを伸ばす
        gameState.currentCount++;

    } else {
        // (C) 別の四天王が押した場合（コンボ中断）
        //    -> コンボをリセットし、新しい四天王でコンボを1から開始
        gameState.currentWinner = currentSpeaker;
        gameState.currentCount = 1;
        console.log(`コンボが中断されました。${gameState.names[currentSpeaker]}のコンボを1から再開します。`);
    }

    // 勝利判定
    if (gameState.currentCount >= winGoal) {
        gameState.isGameOver = true;
        gameState.scores[currentSpeaker]++;
    }
}
// ------------------------------------

// サーバーを起動 (Render対応)
const PORT = process.env.PORT || 3000; 

server.listen(PORT, () => {
    console.log(`サーバーがポート ${PORT} で起動しました。`);
    console.log(`http://localhost:${PORT} にアクセスしてください。`);
});