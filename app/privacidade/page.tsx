import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { ContextualHelp } from "@/components/contextual-help";
import { PRIVACY_TEXT_VERSION } from "@/lib/privacy/policy";

export const metadata: Metadata = { title: "Política de Privacidade" };

export default function PrivacyPolicyPage() {
  return (
    <main className="shell py-8 sm:py-12">
      <Brand />
      <article className="card mx-auto mt-10 max-w-3xl p-6 sm:p-10">
        <p className="eyebrow">Versão {PRIVACY_TEXT_VERSION}</p>
        <h1 className="display mt-3 text-4xl font-bold">Política de Privacidade</h1>
        <p className="mt-4 leading-7 text-[#657168]">
          Esta versão acompanha o MVP do EasyFit e descreve as finalidades essenciais de tratamento. Prazos legais definitivos de retenção ainda dependem de aprovação jurídica antes do lançamento público.
        </p>
        <ContextualHelp href="/conta" linkLabel="Abrir controles da conta">
          Depois de entrar, a área Conta permite revisar consentimentos, solicitar seus dados e excluir a conta. Para dúvidas sobre retenção legal, consulte a versão e a seção correspondentes nesta página.
        </ContextualHelp>
        <div className="mt-8 grid gap-7 leading-7 text-[#3f4a43]">
          <section>
            <h2 className="text-xl font-black text-[#17201b]">Dados utilizados</h2>
            <p className="mt-2">ID de usuário, credencial protegida por hash, perfil corporal, metas, alimentação, alimentos privados, treinos, sessões e registros necessários para segurança e auditoria.</p>
          </section>
          <section>
            <h2 className="text-xl font-black text-[#17201b]">Finalidades essenciais</h2>
            <p className="mt-2">Autenticar sua conta, calcular estimativas transparentes, manter seu histórico, sincronizar registros, proteger operações sensíveis e atender pedidos de exportação ou exclusão.</p>
          </section>
          <section>
            <h2 className="text-xl font-black text-[#17201b]">Escolhas e consentimentos</h2>
            <p className="mt-2">O funcionamento essencial exige o tratamento necessário à prestação do serviço. Análises opcionais de produto podem ser recusadas ou revogadas sem bloquear alimentação, treino ou perfil.</p>
          </section>
          <section>
            <h2 className="text-xl font-black text-[#17201b]">Compartilhamento e fontes</h2>
            <p className="mt-2">Dados pessoais não são públicos. Consultas de código de barras enviam apenas o GTIN à fonte nutricional identificada. Provedores de banco, armazenamento e fila devem receber somente o mínimo necessário.</p>
          </section>
          <section>
            <h2 className="text-xl font-black text-[#17201b]">Seus direitos</h2>
            <p className="mt-2">Na área de conta você pode revisar consentimentos, solicitar uma exportação estruturada e confirmar a exclusão da conta após informar novamente sua senha.</p>
          </section>
          <section>
            <h2 className="text-xl font-black text-[#17201b]">Retenção</h2>
            <p className="mt-2">Exportações possuem validade curta configurável. Dados ativos são removidos na exclusão; comprovantes anonimizados, auditoria e backups seguem a política de retenção que deverá ser aprovada antes do lançamento.</p>
          </section>
        </div>
        <Link href="/cadastro" className="button-primary mt-9">Voltar ao cadastro</Link>
      </article>
    </main>
  );
}
