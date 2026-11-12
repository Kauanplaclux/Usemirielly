# Use Mirielly

Catálogo público e gestão privada de uma loja de moda feminina. Branco e rosa da marca original. Interface responsiva em português.

## Funcionalidades

- Catálogo com busca, categorias, favoritos e atendimento por WhatsApp. O contato não reserva nem baixa estoque.
- Gestão em `/gestao` protegida por senha validada no servidor, sessão HttpOnly de oito horas e limite de tentativas de login.
- Cadastro com foto, cor, descrição, preço, tamanhos, quantidades e custo de compra. As fotos são compartilhadas com o catálogo.
- Entrada com custo médio ponderado, venda, retirada sem receita, estorno com devolução e arquivamento sem perda de histórico.
- Remover peça junto ao nome, com confirmação da mesma senha da gestão: peças sem vendas são excluídas com seus saldos e custos; peças com vendas saem do catálogo e estoque ativo, preservando as vendas anteriores.
- Banco PostgreSQL compartilhado. Transações com bloqueio de estoque e repetição segura dos registros de movimentação.
- Painel de valores realizados por período e visão separada do investimento e valor potencial do estoque atual.
- Custos por peça de etiqueta, sacola, doces e extras; despesas gerais e reserva planejada de reinvestimento.
- Exportação autenticada em JSON de todos os registros e fotos enviadas. O arquivo não inclui senhas nem sessões. Restauração exige procedimento técnico; não há importação automática pela interface.

## Publicação

1. Conecte este repositório ao projeto Netlify `use-mirielly`, branch `main`.
2. O arquivo `netlify.toml` define a pasta pública `public`, as funções e a verificação de sintaxe antes de publicar.
3. `@netlify/database` provisiona o PostgreSQL. As migrações versionadas em `netlify/database/migrations/` são aplicadas pelo Netlify. A disponibilidade depende do plano e das permissões da conta.
4. Configure `ADMIN_PASSWORD_HASH` no Netlify, escopo **Functions**, contexto **Production**, como segredo. O valor tem o formato `salt:scrypt` produzido pela função `hashPassword` de `lib/auth.mjs`. Nunca coloque a senha ou o hash no GitHub. Alterações de variável exigem nova publicação.
5. Deixe o catálogo público no controle de acesso de visitantes do Netlify. A área de gestão continua protegida pelo servidor, independentemente da visibilidade pública do site.

O identificador do projeto Netlify é `3fbfadb2-2d3e-45a2-9d38-cb80f65065f8`. A pasta `.netlify` é ignorada e não vai para o GitHub. Nenhuma credencial integra o código.

## Dados e preservação

O GitHub guarda **código, migrações e histórico de desenvolvimento**. Os dados operacionais ficam no PostgreSQL do Netlify e sobrevivem a novas publicações. Fotos novas são otimizadas no navegador e armazenadas no banco, com limite de 500 KB por imagem. A vitrine consulta o mesmo estoque a cada 20 segundos e ao retornar à página.

Use **Exportar meus dados** na gestão para guardar cópias externas dos registros e das fotos. A exportação é uma fotografia consistente do banco, sem sessões ou credenciais. Dados financeiros reais não são enviados ao repositório público. A rotina de cópias automáticas e a política de retenção devem ser configuradas conforme o plano de hospedagem antes do uso intensivo.

## Cálculos

Todos os valores monetários são inteiros em centavos.

- Margem das peças = receita das vendas − custo das peças vendidas.
- Resultado líquido gerencial = margem − custos extras por peça − despesas do período.
- Reserva sugerida = soma do percentual de cada venda sobre sua contribuição positiva após compra e extras. Reserva apresentada = menor valor entre a sugestão e o resultado positivo do período.
- Disponível após reserva = resultado − reserva. Não é saldo bancário nem conciliação de pagamentos.
- Investimento atual = soma do custo médio × quantidade de cada tamanho ativo.
- Valor potencial = preço de catálogo × quantidade disponível; não é receita recebida.

A venda guarda uma fotografia dos preços, custos extras e percentual de reserva. Abastecer ou editar padrões não altera os custos das vendas anteriores. O custo médio das peças atuais pode ter arredondamento de centavos. Estornos retiram a venda dos resultados da data original e devolvem as unidades pelo custo histórico, recompondo o custo médio atual. Retiradas sem venda reduzem estoque e ficam no histórico, sem entrar automaticamente como despesa. Melhorias são saídas gerenciais no período; não há depreciação contábil.

## Demonstração

A migração inicial inclui oito modelos fictícios, 38 peças e valores ilustrativos. Não inventa vendas nem despesas. Cadastre as peças reais; retire os saldos fictícios como **Retirada**, com observação de demonstração, e arquive-os. As peças novas não recebem selo de demonstração.

## Desenvolvimento local

Node.js 24, `pnpm install`, `pnpm dev`. O banco local é independente da produção e fica na pasta ignorada `.local`.

Uma senha temporária é gerada e exibida ao iniciar o servidor local. Ela não funciona no ambiente publicado: produção exige a variável secreta do Netlify. Para desenvolvimento, é possível definir `LOCAL_ADMIN_PASSWORD` em uma variável local não versionada. `pnpm test` executa testes de integração com PostgreSQL local, incluindo concorrência, estorno, proteção de custos e exportação. `pnpm build` verifica os arquivos e a sintaxe. Nenhuma senha fixa é distribuída no código ou na documentação.

O emulador PGlite local compartilha uma única sessão PostgreSQL; o pool local e os testes usam uma conexão para não misturar transações. Os testes de requisições simultâneas exercitam a fila local e não substituem um teste de concorrência com múltiplas conexões em PostgreSQL real. Em produção, vendas, abastecimentos, remoções e estornos bloqueiam primeiro o produto e depois seus tamanhos, mantendo a mesma ordem de bloqueio.

## Imagens

Logo e ícones de WhatsApp e Instagram fornecidos pela usuária. A logo mantém a arte original; foi apenas recortado o espaço branco externo para exibição.

Fotos ilustrativas da Pexels, sem representar estoque real ou vínculo comercial com modelos/fotógrafos: [vestido rosa](https://www.pexels.com/photo/photo-of-woman-wearing-pink-dress-2065194/), [camiseta](https://www.pexels.com/photo/6311475/), [calça areia](https://www.pexels.com/photo/a-woman-in-white-long-sleeves-smiling-while-wearing-beige-pants-8422348/), [vestido verde](https://www.pexels.com/photo/985635/), [jeans](https://www.pexels.com/photo/a-woman-in-a-button-down-shirt-and-blue-jeans-12117260/), [blazers](https://www.pexels.com/photo/7691223/), [camisa branca](https://www.pexels.com/photo/woman-in-white-long-sleeve-shirt-and-beige-pants-standing-near-potted-plant-7219674/), [camisa listrada](https://www.pexels.com/photo/5886041/).
