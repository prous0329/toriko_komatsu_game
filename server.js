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
    names: { komatsu: '小松', toriko: 'トリコ', sunny: 'サニー', coco: 'ココ', zebra: 'ゼブラ' },
    isGameOver: false // isGameOverが定義されていなかったので追加
};
// ------------------------------------

// クライアント（ブラウザ）からアクセスがあったときにindex.htmlを返す設定
// Renderでファイルを公開するために 'public' フォルダを指定
app.use(express.static('public')); 
app.get('/', (req, res) => {
    // __dirname は server.js があるフォルダを示します
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
        // 小松の操作（リセット役）
        if (data.speaker === 'komatsu') {
             resetGame(); // 小松が押したら無条件でリセット（コンビ結成失敗）
        } else {
            // 四天王の操作（連続役）
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
             }, 3000); // 3秒後に自動リセット
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

    // 連続が続いているかチェック
    if (gameState.currentWinner === currentSpeaker && gameState.currentCount > 0) {
        gameState.currentCount++;
    } else {
        // 新しい四天王が押した、または小松が押した後
        gameState.currentWinner = currentSpeaker;
        gameState.currentCount = 1;
    }

    // 勝利判定
    if (gameState.currentCount >= winGoal) {
        gameState.isGameOver = true;
        gameState.scores[currentSpeaker]++;
    }
}

function resetGame() {
    // 状態を初期値に戻す
    gameState.currentWinner = null;
    gameState.currentCount = 0;
    gameState.isGameOver = false;
    // スコアはそのまま保持
    console.log("ゲーム状態をリセットしました。");
}
// ------------------------------------

// サーバーを起動
// ★Render対応の最重要箇所★
// Renderの環境変数(process.env.PORT)があればそれを使用し、
// なければローカルテスト用に3000を使用します
const PORT = process.env.PORT || 3000; 

// Socket.IOに使うHTTPサーバー(server)で起動します。
server.listen(PORT, () => {
    console.log(`サーバーがポート ${PORT} で起動しました。`);
    console.log(`http://localhost:${PORT} にアクセスしてください。`);
});