# Formato do CSV — Boat Tracker

Este documento descreve exatamente como um arquivo `.csv` deve estar formatado para
ser lido pela aplicação.

## Onde colocar os arquivos

- Um arquivo `.csv` **por operação/missão**, dentro da pasta `data/` na raiz do projeto.
- A pasta pode ser trocada pela variável de ambiente `CSV_DIR`.
- Os arquivos são lidos em ordem alfabética; sugestão de nome: `missao-AAAAMMDD.csv`.
- Os frames de câmera ficam em `data/frames/<mission_id>/<HHMMSS>.jpg`.

## Regras gerais

- Codificação **UTF-8**, separador **vírgula**, quebra de linha `\n` ou `\r\n`.
- A **primeira linha é o cabeçalho** com os nomes exatos das colunas (minúsculas).
- Campos que contenham vírgula devem vir entre aspas duplas (`"Enseada de Jurujuba, Niterói/RJ"`).
  Aspas dentro do campo são escapadas duplicando-as (`""`).
- Cada linha é **uma leitura** em uma coordenada. A **ordem das linhas define a ordem
  temporal do trajeto** (é assim que a rota é desenhada no mapa).
- Colunas ausentes ou vazias aparecem como `—` com marcador de alerta no card.
- Colunas extras são ignoradas.

## Colunas

### Metadados da missão (repetidos em todas as linhas do arquivo)

| Coluna       | Obrigatória | Formato / exemplo                       |
| ------------ | ----------- | --------------------------------------- |
| `mission_id` | sim         | `OP-20260511` (agrupa as linhas)        |
| `data`       | sim         | `2026-05-11` (AAAA-MM-DD)               |
| `local`      | sim         | `"Enseada de Jurujuba, Niterói/RJ"`     |
| `inicio`     | sim         | `6:30` (HH:MM, 24h)                     |
| `fim`        | sim         | `11:30` (usada para calcular a duração) |

### Leitura (uma por linha)

| Coluna                | Formato / exemplo     | Observação                            |
| --------------------- | --------------------- | ------------------------------------- |
| `timestamp`           | `2026-05-11 06:30:00` | instante da coleta                    |
| `lat`                 | `-22.926686`          | graus decimais, ponto como separador  |
| `lon`                 | `-43.119029`          | graus decimais                        |
| `ph`                  | `7.39`                | texto exibido como está               |
| `oxigenio_dissolvido` | `4.87`                | mg/L                                  |
| `temperatura`         | `24.6`                | °C                                    |
| `turbidez`            | `3.7`                 | NTU                                   |
| `salinidade`          | `29.1`                | PSU                                   |
| `mono_p`              | `26`                  | m                                     |
| `multi_p`             | `12` ou vazio         | vazio vira `—`                        |
| `camera_r`            | `OK` / `ALERTA`       | texto livre                           |
| `camera_v`            | `OK` / `ALERTA`       | texto livre                           |
| `frame_v`             | ver abaixo            | imagem da câmera de vante             |
| `frame_r`             | ver abaixo            | imagem da câmera de ré                |
| `frame`               | ver abaixo            | compatibilidade: equivale a `frame_v` |

## Colunas de imagem

`frame_v` e `frame_r` referenciam as imagens de vante e de ré capturadas **no mesmo
instante da leitura**. A coluna antiga `frame` continua aceita como imagem de vante.
Cada coluna aceita duas formas, detectadas automaticamente:

1. **Caminho relativo à pasta de dados** (recomendado):
   `frames/OP-20260511/063000.jpg` — a aplicação serve o arquivo em
   `/api/public/frames/frames/OP-20260511/063000.jpg`.
   Extensões aceitas: `.jpg`, `.jpeg`, `.png`, `.webp`.
2. **URL completa**: `https://exemplo.com/frames/063000.jpg` — usada diretamente.

Se a coluna estiver vazia, o cartão sinaliza a respectiva câmera como `OFF` e mostra um
placeholder. Quando há uma imagem, a câmera aparece como `ON`.

## Exemplo mínimo

```csv
mission_id,data,local,inicio,fim,timestamp,lat,lon,ph,oxigenio_dissolvido,temperatura,turbidez,salinidade,mono_p,multi_p,camera_r,camera_v,frame
OP-20260511,2026-05-11,"Enseada de Jurujuba, Niterói/RJ",6:30,11:30,2026-05-11 06:30:00,-22.926686,-43.119029,7.39,4.87,24.6,3.7,29.1,26,,ALERTA,OK,frames/OP-20260511/063000.jpg
OP-20260511,2026-05-11,"Enseada de Jurujuba, Niterói/RJ",6:30,11:30,2026-05-11 06:31:00,-22.927900,-43.118100,7.41,4.90,24.6,3.9,29.0,25,12,OK,OK,frames/OP-20260511/063100.jpg
```

## Gerando o CSV (`tools/ros2_to_csv.py`)

O script gera o arquivo **completo** (cabeçalho, metadados e todas as leituras) e grava
os frames em `data/frames/<mission_id>/`.

### Modo simulado (padrão, sem hardware)

```bash
python tools/ros2_to_csv.py \
  --mission-id OP-20260601 --data 2026-06-01 \
  --local "Enseada de Jurujuba, Niterói/RJ" \
  --inicio 06:30 --duracao 5h --intervalo 60s
```

Gera um trajeto praia → varredura zigue-zague na água → outro ponto de praia, com valores
de sensores plausíveis e frames copiados de `src/assets/camera-frontal.jpg`.

### Modo ROS2 (dados reais)

Executar no ambiente com ROS2 (`rclpy`, `sensor_msgs`) sourceado:

```bash
python tools/ros2_to_csv.py --source ros2 \
  --mission-id OP-20260601 --duracao 2h --intervalo 5s \
  --topic-gps /gps/fix \
  --topic-image /camera/image_raw/compressed \
  --topic-sensor ph /sensors/ph \
  --topic-sensor temperatura /sensors/temperatura
```

- amostra os tópicos a cada `--intervalo` durante `--duracao` e encerra sozinho;
- a cada amostra grava o último frame recebido em `data/frames/<mission_id>/<HHMMSS>.jpg`
  e escreve o caminho relativo na coluna `frame`;
- `sensor_msgs/Image` (não comprimida) deve ser convertida para JPEG antes — o modo atual
  assina `CompressedImage`.

### Alternativa manual (a partir de um bag)

```bash
ros2 bag play missao.db3            # em um terminal
python tools/ros2_to_csv.py --source ros2 ...   # em outro
```

Ou extrair os frames do bag manualmente, nomeá-los pelo horário (`HHMMSS.jpg`), colocá-los
em `data/frames/<mission_id>/` e preencher a coluna `frame` com esses caminhos.

### Bags do gravador MAVROS

Para as gravações feitas por `rosbag.py` (`GPSRAW` e imagens `bgr8`), use:

```bash
python3 tools/mavros_db3_to_csv.py \
  --db3-path data/bags/teste1 \
  --mission-id OP-20260416 \
  --intervalo 5s
```

O conversor aplica automaticamente o significado dos nomes usados pelo gravador:

- `/mavros/camera/b/raw` (`back`) → `frame_r`, câmera de ré;
- `/mavros/camera/f/raw` (`front`) → `frame_v`, câmera de vante.

O rangefinder pode ser incluído na coluna `mono_p`:

```bash
  --topic-sensor mono_p /mavros/rangefinder/rangefinder
```
#### Iniciar Túnel

cloudflared tunnel --url http://localhost:8080