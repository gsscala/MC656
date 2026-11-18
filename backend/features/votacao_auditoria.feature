# language: pt
Funcionalidade: Votação eletrônica auditável e apuração multi-cenário
  Como eleitor ou administrador institucional
  Quero submeter votos segundo as regras de cada eleição, verificar recibos e auditar resultados
  Para garantir integridade eleitoral sem quebrar o sigilo do voto

  Cenário: Voto válido em Centro Acadêmico gera recibo SHA-256 verificável
    Dado que existe uma eleição aberta "ca-bdd-1" do tipo "centro-academico" com opções "chapa-a,chapa-b", universo 100 e quórum 0.2
    Quando o eleitor "disc-01" com credencial "281210", status "active" e peso 1 vota na opção "chapa-a"
    Então a resposta HTTP deve ter status 201
    E um recibo SHA-256 válido deve ser emitido para o eleitor "disc-01"
    E ao consultar a verificação desse recibo na eleição "ca-bdd-1" o status deve ser 200 e verified verdadeiro

  Cenário: Rejeição de credencial inválida e bloqueio de voto duplicado
    Dado que existe uma eleição aberta "ca-bdd-2" do tipo "centro-academico" com opções "chapa-a,chapa-b", universo 50 e quórum 0.1
    Quando o eleitor "disc-invalido" com credencial "12345", status "active" e peso 1 vota na opção "chapa-a"
    Então a resposta HTTP deve ter status 403
    Quando o eleitor "disc-02" com credencial "654321", status "active" e peso 1 vota na opção "chapa-a"
    Então a resposta HTTP deve ter status 201
    Quando o eleitor "disc-02" com credencial "654321", status "active" e peso 1 vota na opção "chapa-b"
    Então a resposta HTTP deve ter status 409

  Cenário: Apuração ponderada em Assembleia de Condomínio e verificação de quórum
    Dado que existe uma eleição aberta "condo-bdd-1" do tipo "assembleia-condominio" com opções "aprovar,rejeitar", universo 5 e quórum 0.5
    Quando o eleitor "apt-1" com credencial "11122233344", status "active" e peso 0.6 vota na opção "aprovar"
    E o eleitor "apt-2" com credencial "22233344455", status "active" e peso 0.2 vota na opção "rejeitar"
    E o eleitor "apt-3" com credencial "33344455566", status "active" e peso 0.2 vota na opção "rejeitar"
    Quando consulto a apuração parcial da eleição "condo-bdd-1"
    Então a resposta HTTP deve ter status 200
    E a apuração deve apontar 3 votos nominais, vencedor "aprovar" e quórum atingido

  Cenário: Notificação dos observadores em Orçamento Participativo Municipal sem quebra de sigilo
    Dado que existe uma eleição aberta "mun-bdd-1" do tipo "orcamento-municipal" com opções "parque,escola", universo 100 e quórum 0.01
    Quando o eleitor "cid-01" com credencial "CID-991", status "active" e peso 1 vota na opção "parque"
    E o eleitor "cid-02" com credencial "CID-992", status "active" e peso 1 vota na opção "escola"
    Quando consulto o log de auditoria da eleição "mun-bdd-1"
    Então a resposta HTTP deve ter status 200
    E o contador de comparecimento deve registrar 2 votos
    E o log de auditoria deve conter 2 recibos sem expor a opção escolhida
