// Additional UI text used by the port. Original labels come from locales.js.
// Columns: Chinese | Japanese | English | Korean. Do not put chart data here.
export const uiTranslations = Object.fromEntries(
  `
iBMSC 跨平台谱面编辑器|iBMSC クロスプラットフォーム譜面エディター|iBMSC cross-platform chart editor|iBMSC 크로스 플랫폼 채보 편집기
原作：{0}|原作：{0}|Original author: {0}|원작: {0}
移植与维护：{0}|移植・保守：{0}|Port and maintenance: {0}|이식 및 유지보수: {0}
原作贡献者|原作の貢献者|Original contributors|원작 기여자
项目：{0}|プロジェクト：{0}|Project: {0}|프로젝트: {0}
音符编号（按当前 BASE，62 区分大小写）|ノート番号（現在の BASE。62 は大文字・小文字を区別）|Note index (current BASE; 62 is case-sensitive)|노트 번호(현재 BASE, 62는 대소문자 구분)
MyO2 工具箱|MyO2 ツールボックス|MyO2 toolbox|MyO2 도구 상자
关于|ヘルプ|About|정보
转换|変換|Convert|변환
文件头|ヘッダー|Header|헤더
标题|タイトル|Title|제목
作者|アーティスト|Artist|아티스트
曲风|ジャンル|Genre|장르
等级|レベル|Level|레벨
谱面类型|譜面タイプ|Chart type|채보 유형
SINGLE|SINGLE|SINGLE|SINGLE
DOUBLE|DOUBLE|DOUBLE|DOUBLE
PMS|PMS|PMS|PMS
Couple Play|Couple Play|Couple Play|Couple Play
Battle Play|Battle Play|Battle Play|Battle Play
格线|グリッド|Grid|격자
节拍|拍子|Measure|마디
扩展代码|拡張コード|Extended Code|확장 코드
缩放|ズーム|Zoom|확대/축소
1 - Single Play|1 - Single Play|1 - Single Play|1 - Single Play
2 - Couple Play|2 - Couple Play|2 - Couple Play|2 - Couple Play
3 - Double Play|3 - Double Play|3 - Double Play|3 - Double Play
谱面未定义音源|音源が定義されていません|No sounds defined in this chart|채보에 정의된 음원 없음
音源已关联：{0} 个；未能加载：{1} 个|音源読込済み：{0} 個、失敗：{1} 個|Sounds loaded: {0}; failed: {1}|음원 {0}개 불러옴, {1}개 실패
已选取音源 {0}|音源 {0} を選択しました|Selected sound {0}|음원 {0} 선택됨
BPM 必须为正数|BPM は正の数で指定してください|BPM must be positive|BPM은 양수여야 합니다
横向缩放范围为 0.25–99|横倍率の範囲は 0.25–99 です|Horizontal zoom range: 0.25–99|가로 확대/축소 범위: 0.25–99
纵向缩放范围为 0.25–99|縦倍率の範囲は 0.25–99 です|Vertical zoom range: 0.25–99|세로 확대/축소 범위: 0.25–99
小节范围必须为 000–999，起点不得大于终点|小節範囲は 000–999 で、開始は終了以前にしてください|Measure range must be 000–999, with start no later than end|마디 범위는 000–999이며 시작이 끝보다 클 수 없습니다
已打开 {0}|{0} を開きました|Opened {0}|{0} 열림
已开始下载|ダウンロードを開始しました|Download started|다운로드 시작됨
已加载 {0} 个音源；失败 {1} 个|音源 {0} 個を読み込みました。失敗：{1} 個|Loaded {0} sounds; {1} failed|음원 {0}개 불러옴, {1}개 실패
已应用修改|変更を適用しました|Changes applied|변경 적용됨
请输入符合当前 BASE 的编号和有效定义|現在の BASE に対応する番号と有効な定義を入力してください|Enter an index within the current BASE and a valid definition|현재 BASE에 맞는 번호와 유효한 정의를 입력하세요
BPM 必须大于零，STOP 不得为负|BPM は正数、STOP は 0 以上にしてください|BPM must be positive; STOP cannot be negative|BPM은 양수이며 STOP은 음수일 수 없습니다
已更新 #{0}{1}|#{0}{1} を更新しました|Updated #{0}{1}|#{0}{1} 업데이트됨
已复制全部轨道 {0} 行|全レーンの {0} 行をコピーしました|Copied {0} rows from all lanes|모든 레인에서 {0}행 복사됨
请先复制非空区域|先に空でない範囲をコピーしてください|Copy a non-empty range first|먼저 비어 있지 않은 범위를 복사하세요
替换编号超出当前 BASE 范围|置換番号が現在の BASE の範囲外です|Replacement index exceeds the current BASE|바꿀 번호가 현재 BASE 범위를 초과합니다
BPM 03 只能使用十六进制编号|BPM 03 は16進数のみ使用できます|BPM 03 requires a hexadecimal index|BPM 03은 16진수 번호만 사용할 수 있습니다
已导出 IBMSC|IBMSC をエクスポートしました|IBMSC exported|IBMSC 내보내기 완료
已复制 {0} 个音符|ノート {0} 個をコピーしました|Copied {0} notes|노트 {0}개 복사됨
粘贴目标必须为 000–999 小节|貼り付け先は 000–999 小節で指定してください|Paste target must be measure 000–999|붙여넣기 대상은 000–999 마디여야 합니다
已粘贴 {0} 个音符至 {1} 小节|{1} 小節にノート {0} 個を貼り付けました|Pasted {0} notes at measure {1}|{1} 마디에 노트 {0}개 붙여넣음
没有恢复文件|復元ファイルはありません|No recovery file|복구 파일 없음
已恢复自动保存内容，请另存为文件|自動保存から復元しました。名前を付けて保存してください|Autosave restored; save it as a file|자동 저장 복구됨. 다른 이름으로 저장하세요
自动保存失败：{0}|自動保存に失敗しました：{0}|Autosave failed: {0}|자동 저장 실패: {0}
LNOBJ 编号超出当前 BASE 范围|LNOBJ 番号が現在の BASE の範囲外です|LNOBJ index exceeds the current BASE|LNOBJ 번호가 현재 BASE 범위를 초과합니다
已载入主题 {0}|テーマ {0} を読み込みました|Loaded theme {0}|테마 {0} 불러옴
WAV 编号超出当前 BASE 范围|WAV 番号が現在の BASE の範囲外です|WAV index exceeds the current BASE|WAV 번호가 현재 BASE 범위를 초과합니다
请先选择要转换的音符|変換するノートを選択してください|Select notes to convert first|먼저 변환할 노트를 선택하세요
已导入设置|設定をインポートしました|Settings imported|설정 가져오기 완료
设置未能持久保存：{0}|設定を保存できませんでした：{0}|Could not persist settings: {0}|설정 저장 실패: {0}
当前音源尚未加载|現在の音源は未読込です|Current sound is not loaded|현재 음원을 불러오지 않았습니다
请先完成或关闭当前对话框，再拖入文件|ダイアログを閉じてからファイルをドロップしてください|Finish or close the dialog before dropping files|파일을 놓기 전에 대화상자를 완료하거나 닫으세요
主题已应用，但设置保存失败：{0}|テーマは適用されましたが保存に失敗しました：{0}|Theme applied, but settings could not be saved: {0}|테마가 적용되었지만 설정 저장 실패: {0}
已忽略无效的主题设置：{0}|無効なテーマ設定を無視しました：{0}|Ignored invalid theme settings: {0}|잘못된 테마 설정 무시됨: {0}
另存为|名前を付けて保存|Save as|다른 이름으로 저장
播放中，从第 {0} 拍开始|再生中：{0} 拍目から|Playing from beat {0}|{0}박부터 재생 중
长度 = {0}|長さ = {0}|Length = {0}|길이 = {0}
其他键位|その他のキー|Other keys|기타 키
关于 iBMSC|iBMSC について|About iBMSC|iBMSC 정보
服务|サービス|Services|서비스
隐藏 iBMSC|iBMSC を隠す|Hide iBMSC|iBMSC 숨기기
隐藏其他应用|ほかを隠す|Hide others|다른 앱 숨기기
显示全部|すべてを表示|Show all|모두 표시
退出 iBMSC|iBMSC を終了|Quit iBMSC|iBMSC 종료
最近打开|最近使ったファイル|Open recent|최근 파일 열기
暂无最近文件|最近使ったファイルはありません|No recent files|최근 파일 없음
关闭窗口|ウィンドウを閉じる|Close window|창 닫기
完整 BMS 文本|BMS テキスト全体|Full BMS text|전체 BMS 텍스트
窗口|ウィンドウ|Window|창
最小化|最小化|Minimize|최소화
缩放窗口|ウィンドウを拡大 / 縮小|Zoom window|창 확대/축소
切换全屏|フルスクリーン切替|Toggle full screen|전체 화면 전환
全部置于前面|すべてを手前に移動|Bring all to front|모두 앞으로 가져오기
尚未保存|未保存|Unsaved changes|저장되지 않은 변경 사항
谱面有未保存的修改。|譜面に未保存の変更があります。|The chart has unsaved changes.|채보에 저장되지 않은 변경 사항이 있습니다.
返回编辑器保存，或放弃修改并关闭窗口。|エディターに戻って保存するか、変更を破棄して閉じてください。|Return to the editor to save, or discard changes and close.|편집기로 돌아가 저장하거나 변경 사항을 버리고 닫으세요.
返回编辑器|エディターに戻る|Return to editor|편집기로 돌아가기
放弃修改并关闭|変更を破棄して閉じる|Discard and close|변경 사항 버리고 닫기
放弃尚未导出的修改？|未保存の変更を破棄しますか？|Discard changes that have not been exported?|내보내지 않은 변경 사항을 버릴까요?
放弃尚未保存的修改？|未保存の変更を破棄しますか？|Discard unsaved changes?|저장하지 않은 변경 사항을 버릴까요?
打开文件期间谱面发生了修改，仍要替换当前谱面？|読込中に譜面が変更されました。置き換えますか？|The chart changed while opening the file. Replace it anyway?|파일을 여는 동안 채보가 변경되었습니다. 그래도 바꿀까요?
选中编号被 {0} 个事件引用，移除定义会保留音符但使音源缺失。仍然移除？|選択した番号は {0} 件のイベントで使用されています。定義を削除するとノートは残りますが音源がなくなります。削除しますか？|Selected indices are used by {0} events. Removing definitions keeps the notes but removes their sounds. Continue?|선택한 번호가 이벤트 {0}개에서 사용 중입니다. 정의를 삭제하면 노트는 남지만 음원이 누락됩니다. 계속할까요?
BGM 区不可以在 BMS 中存放 LN/CN。继续保存会将这些长音符转为仅在起点播放的普通 BGM 音符，终点不会保存。编辑器中的暂存长条仍保留。是否继续？|BMS の BGM には LN/CN を保存できません。開始位置だけを通常の BGM として保存し、終点は保存しません。エディター内のロングノートは保持されます。続けますか？|BMS cannot store LN/CN in BGM lanes. Saving keeps only their starts as regular BGM notes and omits their ends. The editor keeps the temporary long notes. Continue?|BMS의 BGM 레인에는 LN/CN을 저장할 수 없습니다. 시작점만 일반 BGM 노트로 저장되고 끝점은 저장되지 않습니다. 편집기의 임시 롱노트는 유지됩니다. 계속할까요?
48线总偏差|48分割の総偏差|Total 48-grid deviation|48분할 총 편차
64 线检查工具|64分割チェック|64-grid checker|64분할 검사
64线总偏差|64分割の総偏差|Total 64-grid deviation|64분할 총 편차
BGM 列数|BGM 列数|BGM columns|BGM 열 수
BMS 文本|BMS テキスト|BMS text|BMS 텍스트
BMSE：分别编辑端点|BMSE：始点・終点を個別に編集|BMSE: edit endpoints separately|BMSE: 시작점과 끝점 개별 편집
BPM / STOP 数值|BPM / STOP 値|BPM / STOP value|BPM / STOP 값
BPM 恒速化|BPM の一定化|Constant BPM|BPM 일정하게 변환
BPM 计算|BPM 計算|BPM calculator|BPM 계산
Ctrl＋滚轮|Ctrl＋ホイール|Ctrl+wheel|Ctrl+휠
NT：拖动写入 / 整体移动|NT：ドラッグで入力・全体を移動|NT: drag to draw / move whole note|NT: 드래그 입력 / 노트 전체 이동
Note 上显示文件名|ノートにファイル名を表示|Show file names on notes|노트에 파일 이름 표시
WAV 编号列表|WAV 番号一覧|WAV index list|WAV 번호 목록
可见音符|可視ノート|Visible notes|표시 노트
短音符|通常ノート|Short notes|일반 노트
长音符|ロングノート|Long notes|롱노트
隐藏音符|不可視ノート|Hidden notes|숨김 노트
播放|再生|Play|재생
七键镜像|7鍵ミラー|7-key mirror|7키 미러
下一个|次を検索|Find next|다음 찾기
不透明度|不透明度|Opacity|불투명도
中|中央|Middle|가운데
中点|中点|Midpoint|중간점
主题|テーマ|Theme|테마
从|開始|From|시작
从头播放|最初から再生|Play from beginning|처음부터 재생
从指定小节播放|指定小節から再生|Play from measure|지정 마디부터 재생
使用当前音源|現在の音源を使用|Use current sound|현재 음원 사용
侧栏|サイドバー|Sidebar|사이드바
保存 BMS|BMS を保存|Save BMS|BMS 저장
保存格式|保存形式|Save format|저장 형식
保存编码|文字コード|Encoding|인코딩
保持位置并截断溢出|位置を保持して超過分を切り捨て|Keep position and cut overflow|위치 유지 및 초과 부분 자르기
保持小节内位置|小節内の位置を保持|Keep position within measure|마디 내 위치 유지
保持绝对位置|絶対位置を保持|Keep absolute position|절대 위치 유지
保留小节内位置|小節内の位置を保持|Keep position within measure|마디 내 위치 유지
保留小节内位置并截断溢出|小節内の位置を保持して超過分を切り捨て|Keep measure position and cut overflow|마디 내 위치 유지 및 초과 부분 자르기
保留绝对位置|絶対位置を保持|Keep absolute position|절대 위치 유지
修改编号|番号を変更|Relabel|번호 변경
修改选中音符编号|選択ノートの番号を変更|Relabel selected notes|선택한 노트 번호 변경
修改音符数值|ノートの値を変更|Change note value|노트 값 변경
停止|停止|Stop|정지
全部替换|すべて置換|Replace all|모두 바꾸기
写入定义|定義を設定|Set definition|정의 설정
分割|分割|Divisions|분할
分屏滚动同步|分割画面のスクロール同期|Synchronize pane scrolling|분할 화면 스크롤 동기화
切换 NT / BMSE|NT / BMSE を切り替え|Toggle NT / BMSE|NT / BMSE 전환
初始 BPM|初期 BPM|Initial BPM|초기 BPM
删除匹配|一致するノートを削除|Delete matches|일치 항목 삭제
加粗线|補助線|Major grid|굵은 격자선
加载波形|波形を読み込む|Load waveform|파형 불러오기
加载音源文件|音源ファイルを読み込む|Load sound files|음원 파일 불러오기
单击播放 Key 音|クリックでキー音を再生|Preview key sound on click|클릭 시 키음 재생
变拍方式|拍子変更方式|Measure resize mode|박자 변경 방식
变拍时的音符处理|拍子変更時のノート処理|Notes when resizing measures|박자 변경 시 노트 처리
变拍模式|拍子変更方式|Measure resize mode|박자 변경 방식
右|右|Right|오른쪽
右分屏|右の分割画面|Right pane|오른쪽 분할 화면
同步修改音符编号|ノート番号も変更|Relabel notes as well|노트 번호 함께 변경
吸附网格|グリッドにスナップ|Snap to grid|격자에 맞추기
定位 / 小节操作|移動・小節操作|Navigate / measures|이동 / 마디 편집
导入|インポート|Import|가져오기
导入 SM 难度|SM の難易度を選択|Import SM difficulty|SM 난이도 가져오기
导入原版主题 XML|テーマ XML をインポート|Import theme XML|테마 XML 가져오기
导入设置 XML|設定 XML をインポート|Import settings XML|설정 XML 가져오기
导入语言 XML|言語 XML をインポート|Import language XML|언어 XML 가져오기
导出 .IBMSC|.IBMSC をエクスポート|Export .IBMSC|.IBMSC 내보내기
导出 .IBMSCX|.IBMSCX をエクスポート|Export .IBMSCX|.IBMSCX 내보내기
导出主题 XML|テーマ XML をエクスポート|Export theme XML|테마 XML 내보내기
导出设置 XML|設定 XML をエクスポート|Export settings XML|설정 XML 내보내기
将长度比应用到范围内所有小节|範囲内の全小節に長さの比率を適用|Apply ratio to all measures in range|범위 내 모든 마디에 길이 비율 적용
小节|小節|Measure|마디
小节内位置 / 小节长度|小節内の位置 / 小節長|Position in measure / measure length|마디 내 위치 / 마디 길이
小节范围操作|小節範囲の操作|Measure range operations|마디 범위 편집
小节长度列表|小節長一覧|Measure lengths|마디 길이 목록
小节长度比|小節長の比率|Measure length ratio|마디 길이 비율
尚未选择|未選択|Not selected|선택되지 않음
左|左|Left|왼쪽
左分屏|左の分割画面|Left pane|왼쪽 분할 화면
应用修改|変更を適用|Apply changes|변경 적용
当前 WAV 编号|現在の WAV 番号|Current WAV index|현재 WAV 번호
当前位置|現在位置|Current position|현재 위치
恒速化|一定化|Convert|변환
恢复自动保存|自動保存から復元|Restore autosave|자동 저장 복구
打开 / 保存设置|開く・保存の設定|Open / save settings|열기 / 저장 설정
打开编码|読込時の文字コード|Open encoding|열기 인코딩
打开谱面|譜面を開く|Open chart|채보 열기
拍数|拍数|Beats|박자 수
播放跟随|再生位置を追従|Follow playback|재생 위치 따라가기
文件名 / 数值|ファイル名 / 値|File name / value|파일 이름 / 값
时长（秒）|長さ（秒）|Duration (seconds)|길이(초)
时间选择|時間範囲選択|Time selection|시간 범위 선택
显示 / 隐藏右侧面板|右パネルの表示 / 非表示|Show / hide right panel|오른쪽 패널 표시 / 숨기기
显示 / 隐藏操作面板|操作パネルの表示 / 非表示|Show / hide options panel|설정 패널 표시 / 숨기기
显示加粗线|補助線を表示|Show major grid|굵은 격자선 표시
显示网格|グリッドを表示|Show grid|격자 표시
普通音符 / 事件|通常ノート / イベント|Short note / event|일반 노트 / 이벤트
更多文件头|その他のヘッダー|More headers|추가 헤더
更多文件操作|その他のファイル操作|More file actions|추가 파일 작업
更多编辑工具|その他の編集ツール|More editing tools|추가 편집 도구
替换为|置換後|Replace with|바꿀 내용
最近文件|最近使ったファイル|Recent files|최근 파일
未加载叠加波形|重ね合わせ波形なし|No overlay waveform|겹침 파형 없음
未加载的音源|未読込の音源|Unloaded sounds|불러오지 못한 음원
未命名|無題|Untitled|제목 없음
查找 / 替换|検索 / 置換|Find / replace|찾기 / 바꾸기
格数|分割数|Divisions|분할 수
检查|チェック|Check|검사
检查报告|チェック結果|Check report|검사 결과
横向|横|Horizontal|가로
横向缩放|横方向の倍率|Horizontal zoom|가로 확대/축소
横向缩放滑块|横方向の倍率スライダー|Horizontal zoom slider|가로 확대/축소 슬라이더
每分钟自动保存恢复副本|復元用コピーを毎分保存|Save a recovery copy every minute|매분 복구 사본 저장
水平位置|横位置|Horizontal position|가로 위치
浏览音源|音源を参照|Browse sounds|음원 찾아보기
清除事件|イベントを削除|Clear events|이벤트 삭제
界面语言|表示言語|Interface language|표시 언어
皮肤 / 主题|スキン / テーマ|Skin / theme|스킨 / 테마
目标编号|変更先の番号|Target index|대상 번호
禁止纵向移动|縦方向の移動を禁止|Disable vertical movement|세로 이동 금지
移动 / 交换|移動 / 交換|Move / swap|이동 / 교환
移动 / 交换到编号|移動 / 交換先の番号|Move / swap to index|이동 / 교환할 번호
移除定义|定義を削除|Remove definition|정의 삭제
粘贴到指定小节|指定小節に貼り付け|Paste at measure|지정 마디에 붙여넣기
精度|精度|Precision|정밀도
约分位置|約分した位置|Reduced position|약분한 위치
纵向|縦|Vertical|세로
纵向缩放|縦方向の倍率|Vertical zoom|세로 확대/축소
纵向缩放滑块|縦方向の倍率スライダー|Vertical zoom slider|세로 확대/축소 슬라이더
统计（演奏键区音符数）|統計（演奏レーンのノート数）|Statistics (playable notes)|통계(연주 레인 노트 수)
编号|番号|Index|번호
编号 / 资源定义|番号 / リソース定義|Index / resource definition|번호 / 리소스 정의
编号（空白匹配全部）|番号（空欄ですべて）|Index (blank matches all)|번호(빈칸은 모두 일치)
编辑 BMS 文本|BMS テキストを編集|Edit BMS text|BMS 텍스트 편집
编辑工具|編集ツール|Editing tools|편집 도구
缩放至小节长度|小節長に合わせて拡縮|Scale to measure length|마디 길이에 맞춰 조절
网格位置|グリッド位置|Grid position|격자 위치
网格分割|グリッド分割数|Grid divisions|격자 분할 수
翻页步长|ページ移動量|Page scroll step|페이지 이동 간격
自动|自動|Auto|자동
自动调整|自動調整|Auto adjust|자동 조정
节拍分子|拍子の分子|Time signature numerator|박자 분자
节拍分母|拍子の分母|Time signature denominator|박자 분모
范围变拍|範囲内の拍子を変更|Resize measure range|범위 박자 변경
菜单栏|メニューバー|Menu bar|메뉴 모음
计算|計算|Calculate|계산
设置变拍|拍子を設定|Set measure length|박자 설정
调整到64线|64分割に調整|Adjust to 64-grid|64분할로 조정
调整操作面板宽度|操作パネルの幅を変更|Resize options panel|설정 패널 너비 조절
谱面统计|譜面の統計|Chart statistics|채보 통계
资源定义|リソース定義|Resource definitions|리소스 정의
起点|始点|Start|시작점
起点位置|開始位置|Start position|시작 위치
跳转|移動|Go to|이동
轨道|レーン|Lane|레인
轨道与格线显示|レーンとグリッドの表示|Lanes and grid display|레인 및 격자 표시
转为可见音符|可視ノートに変換|Convert to visible notes|표시 노트로 변환
转为短音符|通常ノートに変換|Convert to short notes|일반 노트로 변환
转为长音符|ロングノートに変換|Convert to long notes|롱노트로 변환
转为隐藏音符|不可視ノートに変換|Convert to hidden notes|숨김 노트로 변환
转换选中音符|選択ノートを変換|Convert selected notes|선택한 노트 변환
输入|入力|Input|입력
输入类型|入力形式|Input type|입력 유형
选择语言|言語を選択|Choose language|언어 선택
选择音源查看波形|音源を選択して波形を表示|Select a sound to view its waveform|음원을 선택하여 파형 보기
通道（空白匹配全部）|チャンネル（空欄ですべて）|Channel (blank matches all)|채널(빈칸은 모두 일치)
锁定首个 BGM 起点|最初の BGM の開始位置を固定|Lock first BGM start|첫 BGM 시작점 고정
长音符 ↔ 短音符|ロングノート ↔ 通常ノート|Long ↔ short notes|롱노트 ↔ 일반 노트
长音符端点|ロングノートの端点|Long note endpoint|롱노트 끝점
长音符输入方式|ロングノートの入力方式|Long note input mode|롱노트 입력 방식
长音符长度|ロングノートの長さ|Long note length|롱노트 길이
隐藏音符 ↔ 可见音符|不可視ノート ↔ 可視ノート|Hidden ↔ visible notes|숨김 노트 ↔ 표시 노트
音源加载状态|音源の読込状況|Sound loading status|음원 불러오기 상태
音源选项|音源オプション|Sound options|음원 옵션
音符编号 / 数值|ノート番号 / 値|Note index / value|노트 번호 / 값
音符编号（01–ZZ）|ノート番号（01–ZZ）|Note index (01–ZZ)|노트 번호(01–ZZ)
音符输入设置|ノート入力設定|Note input settings|노트 입력 설정
默认|デフォルト|Default|기본값
未指定|未指定|Unspecified|미지정
玩家|プレイモード|Player|플레이 모드
判定|判定|Rank|판정
难度|難易度|Difficulty|난이도
长度 =|長さ =|Length =|길이 =
重新关联音源|音源を再読込|Reload sounds|음원 다시 불러오기
未加载音源|音源未読込|No sound loaded|불러온 음원 없음
发现 {0} 项|{0} 件見つかりました|Found {0} items|{0}개 발견
未发现超过 64 线的格数|64分割を超える分割数はありません|No divisions finer than 64-grid found|64분할을 초과하는 분할 없음
已恒速化|BPM を一定にしました|BPM converted|BPM 변환 완료
谱面已改变，请重新检查|譜面が変更されました。再チェックしてください|Chart changed; check again|채보가 변경되었습니다. 다시 검사하세요
已调整|調整しました|Adjusted|조정 완료
当前 {0}，切换输入方式（F8）|現在 {0}：入力方式を切り替え（F8）|Current: {0}; toggle input mode (F8)|현재 {0}: 입력 방식 전환(F8)
原文件值：{0}|元の値：{0}|Original value: {0}|원본 값: {0}
A1–A8 小计|A1–A8 小計|A1–A8 subtotal|A1–A8 소계
D1–D8 小计|D1–D8 小計|D1–D8 subtotal|D1–D8 소계
9 键小计|9鍵小計|9-key subtotal|9키 소계
关于 iBMSC · 作者与贡献者|iBMSC について・作者と貢献者|About iBMSC · Authors and contributors|iBMSC 정보 · 제작자 및 기여자
分子和分母必须为正整数|分子と分母は正の整数で指定してください|Numerator and denominator must be positive integers|분자와 분모는 양의 정수여야 합니다
正在自动关联音源…|音源を読み込んでいます…|Loading sounds…|음원 불러오는 중…
音源关联失败：{0}|音源の読込に失敗しました：{0}|Could not load sounds: {0}|음원 불러오기 실패: {0}
播放结束；缺失音源 {0} 个|再生終了：音源 {0} 個が見つかりません|Playback ended; {0} missing sounds|재생 종료: 음원 {0}개 누락
播放中 · {0} s · 缺失音源 {1} 个|再生中 · {0} s · 音源 {1} 個が見つかりません|Playing · {0} s · {1} missing sounds|재생 중 · {0} s · 음원 {1}개 누락
未发现重叠、缺失定义或未配对长音符|重複・未定義・ロングノートの対応エラーはありません|No overlaps, missing definitions or unpaired long notes|겹침, 정의 누락 또는 짝이 없는 롱노트 없음
没有匹配事件|一致するイベントはありません|No matching events|일치하는 이벤트 없음
找到 {0} 个匹配事件|{0} 件のイベントが一致しました|Found {0} matching events|일치하는 이벤트 {0}개 발견
已载入语言文件 {0}|言語ファイルを読み込みました：{0}|Loaded language file: {0}|언어 파일 불러옴: {0}
总计|合計|Total|합계
错误|エラー|Errors|오류
普通|通常|Short|일반
总数|合計|Total|합계
自定义|カスタム|Custom|사용자 지정
自定义…|カスタマイズ…|Customize…|사용자 지정…
皮肤预览|テーマのプレビュー|Theme preview|테마 미리 보기
颜色|色|Colors|색상
字体和音符|フォントとノート|Fonts and notes|글꼴 및 노트
宽度|幅|Width|너비
字体|フォント|Font|글꼴
大小|サイズ|Size|크기
粗体|太字|Bold|굵게
斜体|斜体|Italic|기울임꼴
预览|プレビュー|Preview|미리 보기
音符|ノート|Note|노트
音符文字|ノート文字|Note text|노트 텍스트
长音符文字|ロングノート文字|Long note text|롱노트 텍스트
轨道背景|レーン背景|Lane background|레인 배경
轨道标题|レーン見出し|Lane heading|레인 제목
工作区背景|編集領域の背景|Workspace background|작업 영역 배경
主格线|主グリッド|Main grid|주 격자
副格线|補助グリッド|Secondary grid|보조 격자
轨道分隔线|レーン区切り線|Lane separators|레인 구분선
小节线|小節線|Measure lines|마디선
BGM 波形|BGM 波形|BGM waveform|BGM 파형
框选边框|選択ボックスの枠線|Selection box border|선택 상자 테두리
时间选择边框|時間選択の枠線|Time selection border|시간 선택 테두리
时间选择中线|時間選択の中間線|Time selection midpoint line|시간 선택 중간선
时间选择背景|時間選択の背景|Time selection background|시간 선택 배경
选中音符|選択中のノート|Selected notes|선택한 노트
音符悬停|ノートのマウスオーバー|Note hover|노트에 마우스를 올렸을 때
调整长度边框|長さ調整時の枠線|Length adjustment border|길이 조정 테두리
错误音符|エラーのあるノート|Invalid notes|오류가 있는 노트
轨道标题字体|レーン見出しのフォント|Lane heading font|레인 제목 글꼴
音符字体|ノートのフォント|Note font|노트 글꼴
小节字体|小節番号のフォント|Measure number font|마디 번호 글꼴
音符高度|ノートの高さ|Note height|노트 높이
文字垂直偏移|文字の縦オフセット|Text vertical offset|텍스트 세로 오프셋
文字水平偏移|文字の横オフセット|Text horizontal offset|텍스트 가로 오프셋
长音符文字水平偏移|ロングノート文字の横オフセット|Long note text horizontal offset|롱노트 텍스트 가로 오프셋
隐藏音符不透明度|不可視ノートの不透明度|Hidden note opacity|숨김 노트 불투명도
音符范围|ノートの範囲|Note scope|노트 범위
已选中|選択中|Selected|선택됨
未选中|未選択|Unselected|선택되지 않음
编号范围|番号の範囲|Index range|번호 범위
数值范围|値の範囲|Value range|값 범위
至|から|to|~
列|列|Columns|열
反选|選択を反転|Invert selection|선택 반전
全不选|すべて選択解除|Select none|모두 선택 해제
操作|操作|Action|작업
替换编号|番号を置換|Replace index|번호 바꾸기
替换数值|値を置換|Replace value|값 바꾸기
取消选择|選択解除|Deselect|선택 해제
删除已选中|選択ノートを削除|Delete selected|선택한 노트 삭제
按条件删除|条件一致を削除|Delete matching|조건 일치 삭제
小节起点|開始小節|First measure|시작 마디
小节终点|終了小節|Last measure|끝 마디
编号起点|開始番号|First index|시작 번호
编号终点|終了番号|Last index|끝 번호
数值起点|値の下限|Minimum value|최솟값
数值终点|値の上限|Maximum value|최댓값
`
    .trim()
    .split("\n")
    .map((row) => {
      const [source, jpn, eng, kor] = row.split("|");
      return [source, { jpn, eng, kor }];
    }),
);
