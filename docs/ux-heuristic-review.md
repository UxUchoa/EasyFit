# Avaliação heurística de UX/UI — EasyFit

Data da revisão: 23/07/2026

Escala: **S1** cosmético, **S2** atrito moderado, **S3** problema importante, **S4** bloqueio de uso.

| Heurística | Evidência encontrada | Severidade | Tratamento |
| --- | --- | --- | --- |
| Visibilidade do estado | Mudanças de rota exibiam dois blocos genéricos e as buscas usavam apenas texto, sem preservar a estrutura esperada. | S3 | Skeletons contextuais por Hoje, Dieta, Treino, Evolução e Perfil; skeleton próprio na busca de alimentos. |
| Correspondência com o mundo real | A navegação mobile usava símbolos abstratos e alguns apareciam corrompidos. | S3 | Ícones SVG reconhecíveis, rótulos preservados e termos já usados pelo produto. |
| Controle e liberdade | O diário misturava ações cotidianas, cópia e administração no mesmo nível visual. | S2 | Ações frequentes permanecem expostas; utilidades são agrupadas em painel expansível sem remover funções. |
| Consistência e padrões | A rota atual não era indicada no menu e o cabeçalho desaparecia ao rolar. | S3 | Estado ativo com `aria-current`, mesma navegação no desktop/mobile e cabeçalho fixo translúcido. |
| Prevenção de erros | Ações destrutivas já pediam confirmação, mas o retorno das operações bem-sucedidas era pouco perceptível. | S2 | Feedback breve e acessível após criar, editar, copiar, confirmar ou remover registros. |
| Reconhecimento em vez de memorização | Os botões do diário tinham rótulos curtos demais e sem explicação de prioridade. | S2 | Ícones, títulos e descrições curtas orientam a escolha entre busca, leitura e adição manual. |
| Flexibilidade e eficiência | Há vários caminhos de entrada de alimento, porém todos competiam visualmente. | S2 | Busca vira ação principal; código de barras e calorias rápidas ficam a um toque; cadastro e cópia continuam acessíveis. |
| Estética e minimalismo | A área de ações do diário formava uma sequência longa de botões e selects antes do conteúdo principal. | S3 | Hierarquia em cartões de ação e painel de opções secundárias recolhível. |
| Recuperação de erros | Mensagens de erro já existem nos formulários e rascunhos locais são preservados. | S1 | Mantido; mensagens continuam próximas ao contexto e com região viva. |
| Ajuda e documentação | Há ajuda contextual e textos explicativos nas tarefas mais complexas. | S1 | Mantido; microtextos foram usados somente onde reduzem ambiguidade. |

## Critérios de implementação

- Nenhuma função existente deve ser removida.
- Ações primárias precisam ter alvo de toque mínimo próximo de 48 px.
- Carregamentos devem reduzir mudança de layout e comunicar o contexto por leitor de tela.
- Movimento deve respeitar `prefers-reduced-motion`.
- Navegação e feedback precisam funcionar com teclado e tecnologias assistivas.
