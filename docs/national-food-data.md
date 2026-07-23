# Fontes brasileiras de alimentos

## Decisão de integração

Não existe uma fonte nacional pública que combine consulta aberta por GTIN e composição nutricional completa. O EasyFit usa uma estratégia em camadas:

1. catálogo privado do usuário e cache local;
2. Open Food Facts para produtos que possuem rótulo cadastrado;
3. busca por nome no Open Food Facts, acionada apenas no envio do formulário;
4. catálogo brasileiro curado para alimentos in natura, vinculando uma identidade GTIN verificada a valores nutricionais de referência TACO/TBCA;
5. cadastro manual pelo rótulo quando nenhuma fonte possui dados suficientes.

O catálogo curado nunca deve inferir um alimento apenas pelo NCM. Cada entrada precisa de revisão humana, referência de identidade e referência nutricional. Os valores devem ser apresentados como referência, pois variedade, maturação e parte consumida alteram a composição.

## Provedores avaliados

- **GS1 Brasil / Verified by GS1:** fonte oficial de identidade GTIN. Possui API OAuth 2.0, mas exige contratação e liberação prévia. É a opção preferencial para metadados quando houver credenciais comerciais.
- **Bluesoft Cosmos:** API brasileira por GTIN, com plano Basic de até 25 consultas diárias. Retorna principalmente dados cadastrais; a própria documentação informa que os dados podem estar incompletos e devem ser revisados.
- **TBCA (USP/FoRC) e TACO (NEPA/Unicamp):** fontes nacionais adequadas para composição nutricional por alimento e por 100 g. Não resolvem identidade por código de barras e não oferecem, na documentação pública, uma API de GTIN.
- **Systax:** possui ampla base brasileira e confirmou o GTIN `03400000675982` como “Maçã nacional kg”, mas não foi encontrada API pública documentada para essa consulta. Scraping não foi adotado.
- **Open Food Facts:** base colaborativa, gratuita e aberta sob ODbL. A consulta de produto por código não exige autenticação. A leitura da câmera acontece localmente com Barcode Detection API ou ZXing; somente o número é enviado ao backend. A busca por nome respeita o limite público de 10 consultas por minuto/IP e seus resultados nutricionais válidos são armazenados no catálogo local com atribuição da fonte.

## Fluxo gratuito no aplicativo

1. o usuário abre o modal a partir da própria tela de dieta;
2. o aparelho lê EAN/UPC/GTIN localmente com BarcodeDetector ou ZXing (MIT);
3. o backend consulta primeiro o catálogo local e depois o Open Food Facts;
4. se o código não existir, o usuário pesquisa por nome no mesmo modal;
5. se ainda não houver resultado, cadastra os números do rótulo em seu catálogo privado;
6. fechar o modal sempre devolve o usuário ao diário que estava usando.

Não há chave, assinatura ou cobrança de API nesse fluxo. Em produção, `OPEN_FOOD_FACTS_CONTACT` deve identificar o responsável pelo aplicativo no `User-Agent`. Para volumes maiores, a própria documentação do Open Food Facts recomenda baixar os exports diários ou hospedar uma instância local do Product Opener/Search-a-licious.

## Inclusão de novas referências

Novas entradas ficam em `lib/catalog/brazilian-foods.ts` e devem incluir:

- GTIN validado e eventuais representações equivalentes;
- nome sem alegações de marca não verificadas;
- composição por 100 g de fonte brasileira citável;
- teste automatizado;
- aviso de que o valor é uma referência quando não provém do rótulo exato.

Uma futura integração adicional nunca deve substituir valores nutricionais do rótulo por estimativas silenciosamente.
