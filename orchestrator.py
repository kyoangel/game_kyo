import os
import subprocess

def run_sandbox_test():
    """啟動 Docker 沙盒驗證 Agent 的程式碼"""
    print("正在將 Agent 的程式碼送入沙盒測試...")

    # 建立並執行 Docker 镜像
    build_cmd = "docker build -t game-sandbox -f sandbox.Dockerfile ."
    run_cmd = "docker run --rm name-sandbox-instance game-sandbox"

    # 執行並補捉編譯結果
    subprocess.run(build_cmd, shell=True, check=True)
    result = subprocess.run(run_cmd, shell=True, capture_output=True, text=True)

    if result.returncode == 0:
        print("🎉 測試通過！程式碼完全正確。")
        return True, result.stdout
    else:
        print("❌ 測試失敗！編譯器回報錯誤。")
        return False, result.stderr

def autonomous_loop():
    max_retries = 5
    for attempt in range(max_retries):
        print(f"\n--- 第 {attempt + 1} 次迭代 ---")

        # 1. 這裡會呼叫 OpenAI/Claude API，讓 Coder Agent 生成 game.ts 並寫入 ./workspace/src/game.ts
        # (我們先假設 Agent 已經寫好了檔案)

        # 2. 放入沙盒測試
        success, log = run_sandbox_test()

        if success:
            print("進入下一個 Review 階段！")
            break
        else:
            print("將錯誤 Log 餵回給 Coder Agent...")
            # 3. 這裡會把 log 重新包進 Prompt 丟給 Coder Agent：「你寫錯了，請修正以下錯誤：...」

    print("達到最大迭代次數或開發成功。")

if __name__ == "__main__":
    autonomous_loop()
