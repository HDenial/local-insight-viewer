# Documentação do CSV + frame de câmera por ponto

## Objetivo

1. Entregar um documento (`docs/FORMATO-CSV.md`) descrevendo exatamente como o CSV deve ser formatado para ser lido pela aplicação.
2. Passar a exibir, em cada ponto, o frame real capturado naquele instante (em vez da imagem fixa atual), com origem em tópico ROS2.

## Formato do CSV (resumo do que será documentado)

- Um arquivo `.csv` por operação, dentro da pasta `data/` (ou pasta apontada por `CSV_DIR`).
- Separador vírgula, UTF-8, primeira linha de cabeçalho, campos com vírgula entre aspas duplas.
- Colunas de missão (repetidas em todas as linhas do arquivo): `mission_id`, `data`, `local`, `inicio`, `fim`.
- Colunas por leitura: `timestamp`, `lat`, `lon`, `ph`, `oxigenio_dissolvido`, `temperatura`, `turbidez`, `salinidade`, `mono_p`, `multi_p`, `camera_r`, `camera_v`.
- Nova coluna: `frame` — referência da imagem daquele instante.
- Campo vazio é exibido como "—" com marcador de alerta; ordem das linhas define a ordem temporal do trajeto.

## Frame por ponto

A coluna `frame` aceita duas formas, detectadas automaticamente:

- Nome de arquivo relativo (recomendado): `frames/OP-20260511/063000.jpg`, resolvido dentro da pasta de dados e servido pela aplicação em uma rota de imagens.
- URL `http(s)://...`: usada diretamente.

Quando `frame` estiver vazio ou o arquivo não existir, o card mostra um placeholder discreto ("sem frame") em vez da imagem fixa atual.

## Workflow ROS2 (documentado no mesmo arquivo)

Um script utilitário `tools/ros2_to_csv.py` (executado fora da aplicação, no ambiente ROS2) que:

- assina o tópico de imagem (`sensor_msgs/Image` ou `CompressedImage`) e os tópicos de GPS/sensores;
- casa cada leitura com o frame mais próximo no tempo (janela configurável);
- salva o JPEG em `data/frames/<mission_id>/<HHMMSS>.jpg`;
- escreve/anexa a linha no CSV da missão com o caminho relativo em `frame`.

O documento também descreve a alternativa manual: extrair frames de um bag (`ros2 bag`) e nomear os arquivos pelo timestamp.

## Detalhes técnicos

- `src/lib/missions.server.ts`: ler a coluna `frame`; `src/lib/missions.functions.ts` e o tipo `Reading` ganham o campo.
- Nova rota de servidor `src/routes/api/public/frames/$.ts` que serve arquivos de imagem apenas de dentro da pasta de dados, com proteção contra path traversal e content-type por extensão.
- `ReadingCard.tsx` passa a usar `reading.frame` (URL direta ou caminho pela rota de frames), mantendo `loading="lazy"`, alt descritivo e fallback.
- Os CSVs de exemplo em `data/` recebem a coluna `frame` preenchida com a imagem de exemplo existente, para o preview continuar mostrando algo.

## Validação

- Abrir a aplicação, passar o mouse e fixar pontos em cada uma das três operações e confirmar que a imagem muda por ponto.
- Conferir que um `frame` vazio mostra o placeholder sem quebrar o card.
