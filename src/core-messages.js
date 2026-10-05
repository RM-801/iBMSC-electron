// Domain errors and diagnostics retain their original Chinese source text.
// Parameters are numbered in source-expression order, including adjacent values.
export const coreMessages = `
无效谱面类型|譜面タイプが無効です|Invalid chart type|채보 유형이 올바르지 않습니다
普通音符位于同轨长音符内部|通常ノートが同じレーンのロングノート内にあります|A regular note is inside a long note in the same lane|같은 레인의 롱 노트 안에 일반 노트가 있습니다
目标 {0} 编号已满，未粘贴|コピー先の {0} 番号に空きがないため、貼り付けませんでした|No free {0} IDs in the destination; nothing was pasted|대상의 {0} 번호가 모두 사용 중이어서 붙여넣지 않았습니다
无法安全转换未知通道 {0} 的进制|不明なチャンネル {0} の基数を安全に変換できません|Cannot safely convert the numeric base of unknown channel {0}|알 수 없는 채널 {0}의 진법을 안전하게 변환할 수 없습니다
{0} 必须大于 0 且小于 65536|{0} は 0 より大きく、65536 未満である必要があります|{0} must be greater than 0 and less than 65536|{0}은(는) 0보다 크고 65536보다 작아야 합니다
定义编号已满|定義番号に空きがありません|No free definition IDs remain|정의 번호가 모두 사용 중입니다
不能在分隔列写入|区切り列には書き込めません|Cannot write to a separator column|구분 열에는 입력할 수 없습니다
无效的小节长度：{0}|無効な小節長：{0}|Invalid measure length: {0}|잘못된 마디 길이: {0}
无效的通道数据：{0}|無効なチャンネルデータ：{0}|Invalid channel data: {0}|잘못된 채널 데이터: {0}
BPM 03 通道必须为十六进制|BPM の 03 チャンネルは 16 進数である必要があります|BPM channel 03 must use hexadecimal values|BPM 03 채널은 16진수를 사용해야 합니다
条件分支未闭合|条件分岐が閉じられていません|Unclosed conditional branch|조건 분기가 닫히지 않았습니다
初始 BPM 必须为正数|初期 BPM は正の数である必要があります|Initial BPM must be positive|초기 BPM은 양수여야 합니다
无效资源编号：{0}|無効なリソース番号：{0}|Invalid resource ID: {0}|잘못된 리소스 번호: {0}
通道数据超出当前 BASE 范围|チャンネルデータが現在の BASE の範囲外です|Channel data exceeds the current BASE range|채널 데이터가 현재 BASE 범위를 벗어납니다
无效 LNOBJ 编号|無効な LNOBJ 番号です|Invalid LNOBJ ID|잘못된 LNOBJ 번호입니다
暂不支持 LNTYPE 2|LNTYPE 2 は現在サポートされていません|LNTYPE 2 is not currently supported|LNTYPE 2는 현재 지원하지 않습니다
BGM 区存有长音符，请先确认保存时仅保留起点|BGM 領域にロングノートがあります。保存時に始点のみが残ることを確認してください|The BGM area contains long notes; confirm that saving will retain only their start points|BGM 영역에 롱 노트가 있습니다. 저장 시 시작점만 유지되는 것을 확인해 주세요
无效的音符位置或音源编号|無効なノート位置または音源番号です|Invalid note position or sound ID|잘못된 노트 위치 또는 음원 번호입니다
03 通道 BPM 必须为 01–FF 十六进制|03 チャンネルの BPM は 16 進数の 01–FF である必要があります|Channel 03 BPM must be hexadecimal 01–FF|03 채널 BPM은 16진수 01–FF여야 합니다
无效音符通道|無効なノートチャンネルです|Invalid note channel|잘못된 노트 채널입니다
该网格组合分辨率过高|このグリッドの組み合わせは解像度が高すぎます|The combined grid resolution is too high|이 그리드 조합의 해상도가 너무 높습니다
目标位置已有事件，操作未覆盖原音符|移動先にイベントがあるため、元のノートを上書きしませんでした|The destination already contains an event; the existing note was not overwritten|대상 위치에 이벤트가 있어 기존 노트를 덮어쓰지 않았습니다
BPM 定义缺失或无效：{0}|BPM 定義がないか無効です：{0}|Missing or invalid BPM definition: {0}|BPM 정의가 없거나 잘못되었습니다: {0}
STOP 定义缺失或无效：{0}|STOP 定義がないか無効です：{0}|Missing or invalid STOP definition: {0}|STOP 정의가 없거나 잘못되었습니다: {0}
不支持的谱面编码|サポートされていない譜面の文字コードです|Unsupported chart encoding|지원하지 않는 채보 인코딩입니다
目标列是分隔列或超出轨道范围|移動先の列が区切り列か、レーンの範囲外です|The target column is a separator or outside the lane range|대상 열이 구분 열이거나 레인 범위를 벗어납니다
BPM / STOP 不可转换为其他类型轨道|BPM / STOP を他の種類のレーンに変換することはできません|BPM / STOP cannot be converted to other lane types|BPM / STOP을 다른 유형의 레인으로 변환할 수 없습니다
移动超出 000–999 小节|移動先が小節 000–999 の範囲外です|The move exceeds measures 000–999|이동 위치가 000–999 마디 범위를 벗어납니다
无效移动方向|無効な移動方向です|Invalid move direction|잘못된 이동 방향입니다
无效网格|無効なグリッドです|Invalid grid|잘못된 그리드입니다
无法移往该轨道|そのレーンには移動できません|Cannot move to that lane|해당 레인으로 이동할 수 없습니다
同轨同位置重叠|同じレーンの同じ位置で重複しています|Overlapping events at the same position in the same lane|같은 레인의 같은 위치에 이벤트가 겹쳐 있습니다
缺少 #{0}{1} 定义|#{0}{1} の定義がありません|Missing #{0}{1} definition|#{0}{1} 정의가 없습니다
长音符端点未配对|ロングノートの端点が対になっていません|Unpaired long-note endpoint|롱 노트 끝점에 짝이 없습니다
不支持拖入的文件：{0}|ドロップされたファイルはサポートされていません：{0}|Unsupported dropped file: {0}|드래그한 파일을 지원하지 않습니다: {0}
一次只能拖入一份谱面，请分别打开|一度にドロップできる譜面は 1 つです。個別に開いてください|Only one chart can be dropped at a time; open them separately|한 번에 채보 하나만 드래그할 수 있습니다. 각각 따로 열어 주세요
请先拖入谱面，再拖入音源；桌面版打开谱面后会自动关联目录音源|先に譜面をドロップしてから音源をドロップしてください。デスクトップ版では譜面を開くと同じフォルダーの音源が自動的に関連付けられます|Drop a chart before dropping sounds; the desktop app automatically links sounds in the chart folder when opening a chart|먼저 채보를 드래그한 다음 음원을 드래그해 주세요. 데스크톱 버전은 채보를 열면 폴더의 음원을 자동으로 연결합니다
小节范围必须在 000–999 内，且起点不大于终点|小節範囲は 000–999 内で、開始小節が終了小節以下である必要があります|The measure range must be within 000–999, with the start no greater than the end|마디 범위는 000–999 이내여야 하며 시작 마디가 끝 마디보다 클 수 없습니다
粘贴位置超出 000–999 小节|貼り付け位置が小節 000–999 の範囲外です|The paste position exceeds measures 000–999|붙여넣기 위치가 000–999 마디 범위를 벗어납니다
粘贴会覆盖已有事件，请先清除目标区域|貼り付けると既存のイベントが上書きされます。先に貼り付け先の範囲を消去してください|Pasting would overwrite existing events; clear the target area first|붙여넣으면 기존 이벤트를 덮어씁니다. 먼저 대상 영역을 지워 주세요
小节必须在 000–999|小節は 000–999 の範囲内である必要があります|The measure must be within 000–999|마디는 000–999 범위 안에 있어야 합니다
第 999 小节有内容，插入将使其溢出|小節 999 に内容があるため、挿入すると範囲外になります|Measure 999 contains data that would overflow on insertion|999 마디에 내용이 있어 삽입하면 범위를 벗어납니다
仅支持 #BASE 16、36 或 62|#BASE は 16、36、62 のみサポートしています|Only #BASE 16, 36, or 62 is supported|#BASE는 16, 36 또는 62만 지원합니다
编号超出当前 BASE 范围|番号が現在の BASE の範囲外です|The ID exceeds the current BASE range|번호가 현재 BASE 범위를 벗어납니다
不能移往分隔列|区切り列には移動できません|Cannot move to a separator column|구분 열로 이동할 수 없습니다
移动超出可用轨道范围|移動先が使用可能なレーンの範囲外です|The move exceeds the available lane range|이동 위치가 사용 가능한 레인 범위를 벗어납니다
请先加载音源文件|先に音源ファイルを読み込んでください|Load a sound file first|먼저 음원 파일을 불러와 주세요
无效小节或长度比|無効な小節または長さの比率です|Invalid measure or length ratio|잘못된 마디 또는 길이 비율입니다
无效变拍模式|無効な拍子変更モードです|Invalid measure-length change mode|잘못된 변박 모드입니다
请选择 000–999 范围内的小节|000–999 の範囲内の小節を選択してください|Select a measure within 000–999|000–999 범위 안의 마디를 선택해 주세요
BPM 范围为 0.0001–65535.9999|BPM の範囲は 0.0001–65535.9999 です|BPM must be within 0.0001–65535.9999|BPM 범위는 0.0001–65535.9999입니다
BPM 定义无效|BPM 定義が無効です|Invalid BPM definition|잘못된 BPM 정의입니다
调整会使长音符长度归零，未修改谱面|調整するとロングノートの長さが 0 になるため、譜面を変更しませんでした|The adjustment would reduce a long note to zero length; the chart was not changed|조정하면 롱 노트 길이가 0이 되므로 채보를 수정하지 않았습니다
起点不能使用 LNOBJ 结束编号|始点には LNOBJ の終点番号を使用できません|The start point cannot use the LNOBJ end ID|시작점에는 LNOBJ 종료 번호를 사용할 수 없습니다
无效的长音符长度|無効なロングノートの長さです|Invalid long-note length|잘못된 롱 노트 길이입니다
该轨道不支持长音符|このレーンはロングノートをサポートしていません|This lane does not support long notes|이 레인은 롱 노트를 지원하지 않습니다
调节后长音符会与同轨道其他音符交叉，操作已取消|調整するとロングノートが同じレーンの他のノートと交差するため、操作を取り消しました|The adjusted long note would overlap other notes in the same lane; the operation was cancelled|조정한 롱 노트가 같은 레인의 다른 노트와 겹치므로 작업을 취소했습니다
工程结构无效|プロジェクト構造が無効です|Invalid project structure|잘못된 프로젝트 구조입니다
工程头信息无效|プロジェクトのヘッダー情報が無効です|Invalid project header information|잘못된 프로젝트 헤더 정보입니다
工程资源定义无效|プロジェクトのリソース定義が無効です|Invalid project resource definitions|잘못된 프로젝트 리소스 정의입니다
工程资源编号或值无效|プロジェクトのリソース番号または値が無効です|Invalid project resource ID or value|잘못된 프로젝트 리소스 번호 또는 값입니다
工程扩展文本无效|プロジェクトの拡張テキストが無効です|Invalid project expansion text|잘못된 프로젝트 확장 텍스트입니다
工程小节长度无效|プロジェクトの小節長が無効です|Invalid project measure length|잘못된 프로젝트 마디 길이입니다
工程行数过多|プロジェクトの行数が多すぎます|The project contains too many rows|프로젝트의 행 수가 너무 많습니다
工程通道无效|プロジェクトのチャンネルが無効です|Invalid project channel|잘못된 프로젝트 채널입니다
工程音符数据无效或过大|プロジェクトのノートデータが無効か、大きすぎます|Project note data is invalid or too large|프로젝트 노트 데이터가 잘못되었거나 너무 큽니다
暂存长音符标记无效|一時保存されたロングノートのフラグが無効です|Invalid temporary long-note flag|잘못된 임시 롱 노트 표시입니다
工程过大|プロジェクトが大きすぎます|The project is too large|프로젝트가 너무 큽니다
不支持的移植版工程版本|サポートされていない移植版プロジェクトのバージョンです|Unsupported port project version|지원하지 않는 이식판 프로젝트 버전입니다
无效布尔设置 {0}|無効な真偽値設定 {0}|Invalid boolean setting {0}|잘못된 불리언 설정 {0}
设置超出范围 {0}|設定値が範囲外です {0}|Setting out of range: {0}|설정이 범위를 벗어납니다: {0}
无效 NT 输入设置|無効な NT 入力設定です|Invalid NT input setting|잘못된 NT 입력 설정입니다
无效长音符输入模式|無効なロングノート入力モードです|Invalid long-note input mode|잘못된 롱 노트 입력 모드입니다
不是 iBMSC 配置文件|iBMSC 設定ファイルではありません|Not an iBMSC configuration file|iBMSC 설정 파일이 아닙니다
工程文件被截断|プロジェクトファイルが途中で切れています|The project file is truncated|프로젝트 파일이 잘렸습니다
无效字符串长度|無効な文字列長です|Invalid string length|잘못된 문자열 길이입니다
工程项目数量无效|プロジェクトの項目数が無効です|Invalid project item count|잘못된 프로젝트 항목 수입니다
该位置无法无损转换为 BMS 网格|この位置を精度を失わずに BMS グリッドへ変換できません|This position cannot be converted to a BMS grid without loss|이 위치를 손실 없이 BMS 그리드로 변환할 수 없습니다
音符超出 000–999 小节|ノートが小節 000–999 の範囲外です|The note exceeds measures 000–999|노트가 000–999 마디 범위를 벗어납니다
不是 iBMSC 工程|iBMSC プロジェクトではありません|Not an iBMSC project|iBMSC 프로젝트가 아닙니다
当前仅支持 iBMSC 3.x 二进制工程|現在は iBMSC 3.x のバイナリプロジェクトのみサポートしています|Only iBMSC 3.x binary projects are currently supported|현재 iBMSC 3.x 바이너리 프로젝트만 지원합니다
未知 iBMSC 数据块：{0}|不明な iBMSC データブロック：{0}|Unknown iBMSC data block: {0}|알 수 없는 iBMSC 데이터 블록: {0}
未知工程轨道：{0}|不明なプロジェクトレーン：{0}|Unknown project lane: {0}|알 수 없는 프로젝트 레인: {0}
原版撤销命令已读取跳过，当前编辑历史从导入时开始|原版の元に戻すコマンドは読み取り後にスキップしました。現在の編集履歴はインポート時点から始まります|Original undo commands were read and skipped; the current edit history starts at import|원본의 실행 취소 명령을 읽은 후 건너뛰었습니다. 현재 편집 기록은 가져온 시점부터 시작됩니다
原版 .IBMSC 格式仅支持 BASE36；请保存为 BMS，以保留当前 BASE 和编号|原版の .IBMSC 形式は BASE36 のみ対応しています。現在の BASE と番号を保持するには BMS として保存してください|The original .IBMSC format only supports BASE36; save as BMS to preserve the current BASE and IDs|원본 .IBMSC 형식은 BASE36만 지원합니다. 현재 BASE와 번호를 유지하려면 BMS로 저장해 주세요
WAV 编号超出当前 BASE 范围|WAV 番号が現在の BASE の範囲外です|The WAV ID exceeds the current BASE range|WAV 번호가 현재 BASE 범위를 벗어납니다
源编号没有音源|コピー元の番号に音源がありません|The source ID has no sound|원본 번호에 음원이 없습니다
无效 WAV 编号|無効な WAV 番号です|Invalid WAV ID|잘못된 WAV 번호입니다
无效音源文件名|無効な音源ファイル名です|Invalid sound filename|잘못된 음원 파일 이름입니다
请先选择 WAV 编号|先に WAV 番号を選択してください|Select a WAV ID first|먼저 WAV 번호를 선택해 주세요
剩余 WAV 编号不足，未更改定义|空いている WAV 番号が不足しているため、定義を変更しませんでした|Not enough free WAV IDs remain; definitions were not changed|남은 WAV 번호가 부족하여 정의를 변경하지 않았습니다
没有该难度的 SM 谱面|この難易度の SM 譜面がありません|No SM chart exists for this difficulty|해당 난이도의 SM 채보가 없습니다
SM NOTES 字段无效|SM の NOTES フィールドが無効です|Invalid SM NOTES field|잘못된 SM NOTES 필드입니다
原版 SM 导入映射仅适用于 dance-single 四列|原版の SM インポートマッピングは dance-single の 4 列にのみ対応しています|The original SM import mapping only supports four-column dance-single charts|원본 SM 가져오기 매핑은 dance-single 4열에만 적용됩니다
SM 超过 1000 小节|SM 譜面が 1000 小節を超えています|The SM chart exceeds 1000 measures|SM 채보가 1000 마디를 초과합니다
SM 行长度不是四列|SM の行が 4 列ではありません|The SM row does not contain four columns|SM 행의 길이가 4열이 아닙니다
SM BPM 数据无效|SM の BPM データが無効です|Invalid SM BPM data|잘못된 SM BPM 데이터입니다
初始 BPM 无效|初期 BPM が無効です|Invalid initial BPM|잘못된 초기 BPM입니다
STOP 定义无效|STOP 定義が無効です|Invalid STOP definition|잘못된 STOP 정의입니다
波形列数无效|波形の列数が無効です|Invalid waveform column count|잘못된 파형 열 수입니다
拍数和秒数必须为正数|拍数と秒数は正の数である必要があります|Beats and seconds must be positive|박 수와 초 수는 양수여야 합니다
波形需要有效初始 BPM|波形には有効な初期 BPM が必要です|The waveform requires a valid initial BPM|파형에는 유효한 초기 BPM이 필요합니다
波形遇到无效 BPM 定义|波形で無効な BPM 定義が見つかりました|The waveform encountered an invalid BPM definition|파형에서 잘못된 BPM 정의를 발견했습니다
无效视觉设置：{0}|無効な表示設定：{0}|Invalid visual setting: {0}|잘못된 표시 설정: {0}
音符高度必须为 1–100|ノートの高さは 1–100 の範囲内である必要があります|Note height must be within 1–100|노트 높이는 1–100 범위 안에 있어야 합니다
音符透明度必须为 0–1|ノートの不透明度は 0–1 の範囲内である必要があります|Note opacity must be within 0–1|노트 불투명도는 0–1 범위 안에 있어야 합니다
无效字体大小：{0}|無効なフォントサイズ：{0}|Invalid font size: {0}|잘못된 글꼴 크기: {0}
Microsoft ADPCM WAV 文件结构无效|Microsoft ADPCM WAV のファイル構造が無効です|Invalid Microsoft ADPCM WAV file structure|Microsoft ADPCM WAV 파일 구조가 올바르지 않습니다
Microsoft ADPCM WAV 格式参数无效|Microsoft ADPCM WAV の形式パラメーターが無効です|Invalid Microsoft ADPCM WAV format parameters|Microsoft ADPCM WAV 형식 매개변수가 올바르지 않습니다
Microsoft ADPCM WAV 音频块无效|Microsoft ADPCM WAV の音声ブロックが無効です|Invalid Microsoft ADPCM WAV audio block|Microsoft ADPCM WAV 오디오 블록이 올바르지 않습니다
Microsoft ADPCM WAV 样本数无效|Microsoft ADPCM WAV のサンプル数が無効です|Invalid Microsoft ADPCM WAV sample count|Microsoft ADPCM WAV 샘플 수가 올바르지 않습니다
Microsoft ADPCM WAV 解码数据过大|Microsoft ADPCM WAV のデコード後のデータが大きすぎます|Decoded Microsoft ADPCM WAV data is too large|디코딩된 Microsoft ADPCM WAV 데이터가 너무 큽니다
主题视觉设置无效|テーマの表示設定が無効です|Invalid theme visual settings|테마 시각 설정이 올바르지 않습니다
主题颜色必须为 32 位 ARGB 整数|テーマの色は 32 ビット ARGB 整数で指定してください|Theme colors must be 32-bit ARGB integers|테마 색상은 32비트 ARGB 정수여야 합니다
颜色必须为 #RRGGBB 格式|色は #RRGGBB 形式で指定してください|Colors must use the #RRGGBB format|색상은 #RRGGBB 형식이어야 합니다
颜色不透明度必须为 0–255 的整数|色の不透明度は 0–255 の整数で指定してください|Color opacity must be an integer from 0 to 255|색상 불투명도는 0–255 사이의 정수여야 합니다
主题列宽必须为 0–999 的整数|テーマの列幅は 0–999 の整数で指定してください|Theme column widths must be integers from 0 to 999|테마 열 너비는 0–999 사이의 정수여야 합니다
主题至少需要一条可见的 A/D 或 BGM 轨道|テーマには表示可能な A/D または BGM レーンが 1 つ以上必要です|The theme needs at least one visible A/D or BGM lane|테마에는 표시되는 A/D 또는 BGM 레인이 하나 이상 필요합니다
查找编号超出当前 BASE 范围|検索番号が現在の BASE の範囲外です|The search index is outside the current BASE range|찾을 번호가 현재 BASE 범위를 벗어났습니다
查找编号范围起点不能大于终点|検索番号の開始値は終了値以下にしてください|The first search index must not exceed the last|찾을 번호의 시작값은 끝값보다 클 수 없습니다
查找数值必须为 0.0001–65535.9999，最多四位小数|検索値は 0.0001–65535.9999 の範囲で、小数点以下 4 桁までにしてください|Search values must be between 0.0001 and 65535.9999 with at most four decimal places|찾을 값은 0.0001–65535.9999 범위이며 소수점 이하 네 자리까지 입력할 수 있습니다
查找数值范围起点不能大于终点|検索値の下限は上限以下にしてください|The minimum search value must not exceed the maximum|찾을 값의 최솟값은 최댓값보다 클 수 없습니다
查找轨道范围无效|検索対象のレーン範囲が無効です|Invalid search lane range|찾을 레인 범위가 올바르지 않습니다
查找类型选项无效|検索対象の種類の設定が無効です|Invalid search type option|찾을 유형 옵션이 올바르지 않습니다
无效查找操作|無効な検索操作です|Invalid find operation|올바르지 않은 찾기 작업입니다
`
  .trim()
  .split("\n")
  .map((line) => {
    const [source, jpn, eng, kor] = line.split("|");
    return { source, jpn, eng, kor };
  });
