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
    lastSpeaker: null, // 直前に押した人を追跡
    isComboActive: false // ★追加: コンボが有効な状態で開始されているかを示すフラグ
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
             // 小松が押したら、コンボをリセットし、開始可能状態にする
             resetGame(); 
        } else { 
            // 四天王の操作
            checkWin(speaker); 
        }
        
        // 誰が押したかを最後に記録する
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

// 小松が押したときの関数（コンボをリセットし、開始可能にする）
function resetGame() {
    gameState.currentWinner = null; 
    gameState.currentCount = 0;     
    gameState.isGameOver = false;
    gameState.isComboActive = false; // コンボを無効化
    console.log("小松が押しました。コンボ開始のチャンスです！");
}

// ゲームオーバー後の初期化（スコアは維持）
function resetComboStateOnly() {
    gameState.currentWinner = null;
    gameState.currentCount = 0;
    gameState.isGameOver = false;
    gameState.lastSpeaker = null; 
    gameState.isComboActive = false;
    console.log("ゲームオーバー後の状態をリセットしました。");
}

function checkWin(currentSpeaker) {
    const winGoal = gameState.winConditions[currentSpeaker];
    const previousWinner = gameState.currentWinner; 
    const previousSpeaker = gameState.lastSpeaker; // 最後のボタンを押した人

    // 1. コンボの開始判定 (currentCount === 0の時のみ)
    if (gameState.currentCount === 0) {
        
        if (previousSpeaker === 'komatsu') {
            // (A) 正しいコンボ開始: 小松の直後
            gameState.currentWinner = currentSpeaker;
            gameState.currentCount = 1;
            gameState.isComboActive = true; // コンボを有効化
            
        } else {
            // (B) 誤ったコンボ開始: 小松の直後ではない
            //    -> 何もせずに終了（currentCount=0のまま維持）
            gameState.currentWinner = currentSpeaker; // 押した人として記録はする
            gameState.isComboActive = false;
            console.log("コンボ開始失敗！小松が押す必要があります。");
            return; 
        }
    }
    
    // 2. コンボの継続/中断判定 (currentCount > 0 の時)
    else { 
        if (previousWinner === currentSpeaker && gameState.isComboActive) {
            // (C) 同じ四天王が連続で押した (コンボ継続)
            gameState.currentCount++;

        } else {
            // (D) 別の四天王が押した（または無効な状態での連続押し）
            //     コンボを完全にリセット（0に戻す）
            gameState.currentWinner = currentSpeaker;
            gameState.currentCount = 1; // 1から再開はさせるが、isComboActiveはfalseのままなので勝利できない
            gameState.isComboActive = false; // コンボを無効化
            console.log("コンボ中断！別の四天王が押したか、連続が途切れました。");
        }
    }

    // 勝利判定は、コンボが有効な場合のみ行う
    if (gameState.currentCount >= winGoal && gameState.isComboActive) {
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