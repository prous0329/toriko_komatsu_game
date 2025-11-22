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
    // 勝利条件など、他の設定もここに保持
    winConditions: { toriko: 5, sunny: 3, coco: 3, zebra: 3 },
    names: { komatsu: '小松', toriko: 'トリコ', sunny: 'サニー', coco: 'ココ', zebra: 'ゼブラ' }
};
// ------------------------------------

// クライアント（ブラウザ）からアクセスがあったときにindex.htmlを返す設定
app.use(express.static('public')); // publicフォルダ内のファイルを公開
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// Socket.IO接続イベントの処理
io.on('connection', (socket) => {
    console.log('新しいプレイヤーが接続しました:', socket.id);

    // 接続したプレイヤーに現在のゲーム状態を送信
    socket.emit('update_game_state', gameState);

    // ★クライアントからのボタン操作イベントを受け取る★
    socket.on('player_action', (data) => {
        console.log(`[${data.speaker}] ボタンが押されました`);

        // --- サーバー上でゲームロジックを実行 ---
        if (data.speaker !== 'komatsu') {
            checkWin(data.speaker);
        }
        // ----------------------------------------
        
        // 操作情報と最新の状態を全クライアントに配信
        io.emit('new_action', data); // ボタンが押されたことを全員に通知
        io.emit('update_game_state', gameState); // 最新のゲーム状態を全員に通知

        // ゲーム終了後の自動リセット
        if (gameState.isGameOver) {
             console.log(`ゲーム終了！勝利者: ${gameState.currentWinner}`);
             setTimeout(() => {
                resetGame();
                io.emit('update_game_state', gameState); // リセット後の状態を配信
             }, 100); // 即時リセット
        }
    });

    // クライアントが切断したときの処理
    socket.on('disconnect', () => {
        console.log('プレイヤーが切断しました:', socket.id);
    });
});

// --- サーバー側のゲームロジック ---
function checkWin(currentSpeaker) {
    const winGoal = gameState.winConditions[currentSpeaker];

    if (gameState.currentWinner === currentSpeaker) {
        gameState.currentCount++;
    } else {
        gameState.currentWinner = currentSpeaker;
        gameState.currentCount = 1;
    }

    if (gameState.currentCount >= winGoal) {
        gameState.isGameOver = true;
        gameState.scores[currentSpeaker]++;
    }
}

function resetGame() {
    gameState.currentWinner = null;
    gameState.currentCount = 0;
    gameState.isGameOver = false;
    // ログはクライアント側でクリアさせる
}
// ------------------------------------

// サーバーを起動
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`サーバーがポート ${PORT} で起動しました。`);
    console.log(`http://localhost:${PORT} にアクセスしてください。`);
});