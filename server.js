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
    comboStarted: false // ★追加: コンボがすでに開始されているかを示すフラグ
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

// 小松が押したときの関数（コンボをリセットし、開始権を失わせる）
function resetGame() {
    // 状態を完全に初期値に戻す（小松が押すことでコンボが中断される）
    gameState.currentWinner = null; 
    gameState.currentCount = 0;     
    gameState.isGameOver = false;
    gameState.comboStarted = false; // ★重要: コンボ開始権を失わせる
    console.log("小松が押しました。コンボ状態をリセットし、新しいコンボの準備ができました。");
}

// ゲームオーバー後の初期化（スコアは維持）
function resetComboStateOnly() {
    gameState.currentWinner = null;
    gameState.currentCount = 0;
    gameState.isGameOver = false;
    gameState.lastSpeaker = null; 
    gameState.comboStarted = false;
    console.log("ゲームオーバー後の状態をリセットしました。");
}

function checkWin(currentSpeaker) {
    const winGoal = gameState.winConditions[currentSpeaker];
    const previousWinner = gameState.currentWinner; 
    const previousSpeaker = gameState.lastSpeaker; // 最後のボタンを押した人

    // 1. コンボがまだ開始されていない場合の処理 (初期状態 or 小松が押した後)
    if (!gameState.comboStarted) {
        
        if (previousSpeaker === 'komatsu' || previousWinner === null) {
            // (A) 正しいコンボ開始: 直前が小松、または初期状態の最初の押し
            gameState.currentWinner = currentSpeaker;
            gameState.currentCount = 1;
            gameState.comboStarted = true; // ★コンボ開始権を獲得
            
        } else {
            // (B) 誤ったコンボ開始: 小松の後に押されていない (例: ココ -> ココ)
            //     コンボは開始させず、カウントも0のまま維持する
            gameState.currentWinner = currentSpeaker; // 押した人として記録はする
            gameState.currentCount = 0; // ★カウントを0のまま維持し、勝利を阻止
            console.log("コンボ開始失敗！小松が押す必要があります。");
            return; // これ以上処理せずに終了
        }
    }
    
    // 2. コンボが開始された後の処理 (連続押し or 中断)
    else { // gameState.comboStarted === true の場合
        
        if (previousWinner === currentSpeaker) {
            // (C) 同じ四天王が連続で押した場合（コンボ継続）
            gameState.currentCount++;

        } else {
            // (D) 別の四天王が押した場合（コンボ中断）
            //     コンボをリセットし、新しい四天王でコンボを1から開始
            gameState.currentWinner = currentSpeaker;
            gameState.currentCount = 1;
            console.log(`コンボが中断されました。${gameState.names[currentSpeaker]}のコンボを1から再開します。`);
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