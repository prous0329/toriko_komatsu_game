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
    currentWinner: null,
    currentCount: 0,
    scores: { toriko: 0, sunny: 0, coco: 0, zebra: 0 },
    winConditions: { toriko: 5, sunny: 3, coco: 3, zebra: 3 },
    names: { komatsu: '小松', toriko: 'トリコ', sunny: 'サニー', coco: 'ココ', zebra: 'ゼブラ' },
    isGameOver: false,
    comboReady: false // ★追加：小松が押したらtrueになる（コンボ準備完了）
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
             resetGame(); // 小松はコンボをリセットする役割（コンボスタートの準備）
        } else { 
            checkWin(speaker); // 四天王の操作
        }
        // ----------------------------------------
        
        io.emit('new_action', data); 
        io.emit('update_game_state', gameState); 

        // ゲーム終了後の自動リセット
        if (gameState.isGameOver) {
             console.log(`ゲーム終了！勝利者: ${gameState.currentWinner}`);
             setTimeout(() => {
                 // スコアは維持したまま、コンボ状態のみリセット
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

// 小松が押したときの関数（コンボ継続準備）
function resetGame() {
    gameState.isGameOver = false;
    gameState.comboReady = true; // ★小松が押したので、コンボ継続準備OK！
    console.log("ゲーム状態をリセットしました（小松がコンボの準備をしました）。");
}

// ゲームオーバー後の初期化（スコアは維持）
function resetComboStateOnly() {
    gameState.currentWinner = null;
    gameState.currentCount = 0;
    gameState.isGameOver = false;
    gameState.comboReady = false; 
    console.log("ゲームオーバー後の状態をリセットしました。");
}

function checkWin(currentSpeaker) {
    const winGoal = gameState.winConditions[currentSpeaker];

    // 1. 異なる四天王が押した場合 or リセット後の最初の押し
    if (gameState.currentWinner !== currentSpeaker) {
        gameState.currentWinner = currentSpeaker;
        gameState.currentCount = 1;
        gameState.comboReady = false; // 新しいコンボが始まったのでreadyはfalse
        
    } else {
        // 2. 同じ四天王が連続で押した（コンボ継続の判定）
        
        // ★変更点：小松が直前に押した（comboReadyがtrue）の場合のみコンボを継続させる★
        if (gameState.comboReady) {
            gameState.currentCount++; // 小松のおかげでコンボ継続
            gameState.comboReady = false; // コンボ継続後はreadyをfalseに戻す
        } else {
            // 小松が介在せず、四天王が連続で押した場合は、コンボは維持されない（1のまま）。
            // currentCountは1のまま維持されます
        }
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