-- ====================================================================================
-- Adiciona o codigo SGDE (codigo oficial do aluno na Secretaria) ao cadastro de alunos.
-- Fonte: planilhas "relNotaseFaltasPorTurma" (Relatorios notas), coluna "Cod. Estudante".
-- 495 alunos identificados por nome (normalizado, sem acento) cruzando
-- com o cadastro atual. 15 alunos das planilhas nao tem correspondente atual
-- (provavelmente transferidos/saida da escola) e ficam de fora — ver lista no final deste arquivo.
-- ====================================================================================

ALTER TABLE public.alunos ADD COLUMN IF NOT EXISTS codigo_sgde text;
CREATE UNIQUE INDEX IF NOT EXISTS alunos_codigo_sgde_idx ON public.alunos (codigo_sgde) WHERE codigo_sgde IS NOT NULL;

UPDATE public.alunos SET codigo_sgde = '908315' WHERE id = '85e1f4f7-f5e1-484b-ad29-bc31f76d7100'; -- MIGUEL GUSTAVO BARBOSA COSTA
UPDATE public.alunos SET codigo_sgde = '936694' WHERE id = 'da47b84a-43db-4fb5-aec0-5762fc677314'; -- ANA CLARA PAIVA VAZ
UPDATE public.alunos SET codigo_sgde = '991264' WHERE id = '5506766f-6e22-424f-ae3b-5c34b16e71c2'; -- VITOR HUGO DE CARVALHO PEREIRA RATIER ORTIZ
UPDATE public.alunos SET codigo_sgde = '1016406' WHERE id = '9a5d7f15-63be-4e31-b61b-0005d2be06ae'; -- MARIA EDUARDA DOS SANTOS FERREIRA
UPDATE public.alunos SET codigo_sgde = '1033509' WHERE id = 'a73b324d-40a1-4bb1-b279-bbc8c9c44403'; -- GUSTAVO HENRIQUE DA SILVA PINHEIRO
UPDATE public.alunos SET codigo_sgde = '1055983' WHERE id = '78465469-0e55-41c0-b2f1-094db0429640'; -- MARCOS ALBERTO PARENTE LIDIO
UPDATE public.alunos SET codigo_sgde = '1064420' WHERE id = '0e9ddf37-8acc-47f8-a530-c9214003896e'; -- MARIA JÚLIA DOS SANTOS
UPDATE public.alunos SET codigo_sgde = '1086479' WHERE id = '98bc3612-b05f-404b-b8aa-73b92ce12579'; -- KAUÃ FELIPE JACYNTHO CAVALCANTE
UPDATE public.alunos SET codigo_sgde = '1135473' WHERE id = 'b4c51da7-977b-47e5-bfb9-ff480cef5c30'; -- MURILLO SOUZA DA SILVA
UPDATE public.alunos SET codigo_sgde = '1186632' WHERE id = '738d8d5f-afb9-45b5-9d2d-ef350d421845'; -- LUCAS GUTIERREZ NICOLAU
UPDATE public.alunos SET codigo_sgde = '1194913' WHERE id = '34b1c49a-01b9-409f-a000-a71b99e2bff5'; -- GUSTAVO DOS SANTOS MADIA
UPDATE public.alunos SET codigo_sgde = '1233067' WHERE id = 'e87bcc65-80b0-4d77-b456-fcb80ce58380'; -- WESLEY MODESTO DE OLIVEIRA
UPDATE public.alunos SET codigo_sgde = '1271265' WHERE id = 'b21094fe-1030-47b6-bf15-eff7a16d85ab'; -- JULIANA DUARTE COENGA
UPDATE public.alunos SET codigo_sgde = '1275203' WHERE id = '6426e52a-1663-4e38-9d80-7709290d92eb'; -- JULIA RAMIRO DA SILVA
UPDATE public.alunos SET codigo_sgde = '1300649' WHERE id = '9554d637-c66d-4bbf-a931-af2d7780ebbc'; -- DANIEL VARGAS DA CONCEIÇÃO
UPDATE public.alunos SET codigo_sgde = '1315533' WHERE id = '1ee61093-1718-4b76-bb72-ad6d693e3ccc'; -- IZABELLA DA COSTA BARÔA DE CAMARGO
UPDATE public.alunos SET codigo_sgde = '1332784' WHERE id = '5b775f39-88a3-4f3e-8512-cfe5f3fe9092'; -- ANNA KETHELING FERNANDES
UPDATE public.alunos SET codigo_sgde = '1344175' WHERE id = 'a11ef7a2-d312-4ba7-af37-ddbd9c4408c1'; -- DANIELLA DE ALMEIDA RODRIGUES
UPDATE public.alunos SET codigo_sgde = '1351764' WHERE id = '4704784e-3918-4403-8081-6b6aa68c5d13'; -- FELLIPE FRANCISCO DEGAN DE MIRANDA
UPDATE public.alunos SET codigo_sgde = '1356427' WHERE id = '54610384-0844-42c2-9e1b-62b148a5f63f'; -- KAIO RODRIGUES GOMES MACIEL
UPDATE public.alunos SET codigo_sgde = '1358069' WHERE id = '886d1d61-465c-4b33-8423-62de6e7beeb9'; -- MANUELLA SANTANA GOMES
UPDATE public.alunos SET codigo_sgde = '1413387' WHERE id = '15518d83-aad7-4e5d-8c86-bbfeee169611'; -- LUANNY LAVINIA CEGOVIA DE OLIVEIRA
UPDATE public.alunos SET codigo_sgde = '1419882' WHERE id = 'ed1ab918-7b84-4165-92ab-9ab3d6fd7369'; -- VINÍCIUS PEREIRA DE LIMA
UPDATE public.alunos SET codigo_sgde = '1421230' WHERE id = '242a611d-41fe-4a1a-866e-f8c6e1bea3f0'; -- MATHEUS ALVES BENTO GOMES
UPDATE public.alunos SET codigo_sgde = '1434482' WHERE id = '264faada-ee19-4322-a615-60dd24b2916f'; -- EMILY GABRIELI GALVÃO MION
UPDATE public.alunos SET codigo_sgde = '1434847' WHERE id = '5fe032ce-a69d-4750-99bb-576632686407'; -- SARAH SILVA DE OLIVEIRA
UPDATE public.alunos SET codigo_sgde = '1439985' WHERE id = 'c2ba1f0a-7b91-4b10-be21-21a9eb096678'; -- RAFAEL PINHEIRO PADILHA
UPDATE public.alunos SET codigo_sgde = '1443893' WHERE id = '0d8b7509-30a9-42ec-a73f-e3254ea4d667'; -- GABRIELE RORIZ PAES
UPDATE public.alunos SET codigo_sgde = '1444392' WHERE id = 'c8c46fde-2f85-4a30-8b57-a3504e1ca48f'; -- GABRIELLE ALGIMIRO DA SILVA
UPDATE public.alunos SET codigo_sgde = '1444486' WHERE id = '5c7e8f05-367d-4d91-87a6-4d4e94d5ff8f'; -- VINÍCIUS KRUK CHAVES
UPDATE public.alunos SET codigo_sgde = '1445236' WHERE id = 'f7e9c565-2820-4bb2-8538-85c133e80cd5'; -- MATEUS DO NASCIMENTO CUELLAR
UPDATE public.alunos SET codigo_sgde = '1445911' WHERE id = '4ea44e99-dbd7-46a3-967e-3ffda0f2c85a'; -- YASMIN SANTANA DE JESUS
UPDATE public.alunos SET codigo_sgde = '1448204' WHERE id = '1d264080-80c0-4a2e-8187-617c8e7a91a2'; -- JENNIFER MIGUEL ALVES
UPDATE public.alunos SET codigo_sgde = '1449238' WHERE id = 'e95cb4a0-cf6d-431f-8b00-7704c35724f0'; -- YASMIN VICTÓRIA IRALA VALENSUELLOS
UPDATE public.alunos SET codigo_sgde = '1456936' WHERE id = 'dc0eca48-576b-4134-87b8-029ac02f3914'; -- MARIA GABRIELA LEITE ARAGÃO
UPDATE public.alunos SET codigo_sgde = '1457143' WHERE id = '2b5f32de-2aaa-40f1-8ef7-a9377c86c46d'; -- VICTOR OLIVEIRA BENITEZ
UPDATE public.alunos SET codigo_sgde = '1458540' WHERE id = '5a36b53f-b336-4f7f-acdb-07505470d8b3'; -- DAVI ALEXANDRE XAVIER DINIZ
UPDATE public.alunos SET codigo_sgde = '1458811' WHERE id = 'bdce8a9e-e46b-48db-8ac1-a694ebadf6cc'; -- VICTOR HUGO BENITEZ
UPDATE public.alunos SET codigo_sgde = '1462615' WHERE id = '12818f3d-f405-49bd-8be8-8fa4dc645995'; -- SOPHIA PONTES DE OLIVEIRA CORREIA
UPDATE public.alunos SET codigo_sgde = '1463714' WHERE id = '227103a4-e139-48da-8a63-0237217af4af'; -- NICOLAS GABRIEL ARMÔA FERNANDES
UPDATE public.alunos SET codigo_sgde = '1465224' WHERE id = 'e45a731a-3adc-4ccb-8b8e-3ed8c4dc06a1'; -- KARLOS RAFAEL DA ROSA SALES
UPDATE public.alunos SET codigo_sgde = '1467077' WHERE id = '836ebf0e-682f-4006-adea-244962656069'; -- BEATRIZ  MALTA DE ALMEIDA FERNANDES VIANA
UPDATE public.alunos SET codigo_sgde = '1471011' WHERE id = '4864b718-c766-4918-b614-26585bae2fcf'; -- ANA LUIZA DOS SANTOS BRUM
UPDATE public.alunos SET codigo_sgde = '1483584' WHERE id = '34f5bf20-4fdb-4689-9bae-bafa2c4ec370'; -- JEREMIAS TEIXEIRA COSTA PEREIRA
UPDATE public.alunos SET codigo_sgde = '1015151' WHERE id = '57049311-fea9-4069-9c81-378c0f203635'; -- IZABELLY AYUMI FRANCO SALVATIERRA
UPDATE public.alunos SET codigo_sgde = '1084373' WHERE id = 'e8cb7478-eeb4-4d9f-8db5-3fc35387edba'; -- PEDRO HENRIQUE MIRANDA RONDON
UPDATE public.alunos SET codigo_sgde = '1224618' WHERE id = 'f43364be-9da7-4b51-8cae-235b900a7172'; -- JOSÉ OTÁVIO VERISSIMO DA SILVA
UPDATE public.alunos SET codigo_sgde = '1278319' WHERE id = '63d49179-af9c-43e0-ba15-8ae349c5f6dd'; -- YASMIN TOLEDO DE BRITO DUARTE INSFRAN
UPDATE public.alunos SET codigo_sgde = '1287833' WHERE id = 'c12e5638-29e4-4534-8f27-afd35c22eb63'; -- SARA DE DEUS DA SILVA
UPDATE public.alunos SET codigo_sgde = '1310507' WHERE id = 'd8040506-e873-4dab-ae84-ad8b6d5b3e09'; -- THALLYS LUAN SALAZAR GOMES
UPDATE public.alunos SET codigo_sgde = '1335141' WHERE id = '7edf64b8-125c-447d-97ae-10360fca2a1b'; -- MONIK ALEXANDRA ACOSTA SANTOS
UPDATE public.alunos SET codigo_sgde = '1353619' WHERE id = 'e1dd8ebb-9836-4f54-ae76-7d819312a65b'; -- EDUARDA KAROLYNE MENDES TEIXEIRA
UPDATE public.alunos SET codigo_sgde = '1357170' WHERE id = 'a861ec81-5501-443c-9d23-56c77e576c35'; -- FERNANDA SOUSA DA SILVA
UPDATE public.alunos SET codigo_sgde = '1358085' WHERE id = 'bb07cf01-b464-425c-8425-f1d681073748'; -- GIOVANNA PEREIRA CORREIA DE ARAUJO
UPDATE public.alunos SET codigo_sgde = '1358701' WHERE id = '3595c794-0703-487b-acad-684f92749ead'; -- LEONARDO ALVES BATISTA
UPDATE public.alunos SET codigo_sgde = '1369738' WHERE id = 'ca292f97-0de9-48cc-b342-df0fa1d8b04a'; -- ELYSIE SILVA NOGUEIRA
UPDATE public.alunos SET codigo_sgde = '1373295' WHERE id = '373e9d04-4cf5-4718-9b6b-04849a3e9643'; -- JONATHAN ALVES DE ARAUJO
UPDATE public.alunos SET codigo_sgde = '1391607' WHERE id = '9885c246-a225-491f-b8c3-38427aac2171'; -- IVANILDO DOS SANTOS SANTANA
UPDATE public.alunos SET codigo_sgde = '1411159' WHERE id = '071efb27-6276-40e5-ae35-b593c73042a2'; -- RAFHAELLA FERNANDES CAVALCANTE
UPDATE public.alunos SET codigo_sgde = '1418521' WHERE id = 'fb8a07e0-a36c-4330-bbdb-be30ecc73b7a'; -- MARIA LUIZA ORTELHADO BOMFIM
UPDATE public.alunos SET codigo_sgde = '1420468' WHERE id = 'f05d145f-7aec-4a5f-979a-c4279064bc98'; -- ANNY KAROLLINY ALMEIDA PARREIRA DA SILVA
UPDATE public.alunos SET codigo_sgde = '1435049' WHERE id = '8a8d7ff6-0365-44c7-8c21-cd8a2cc1da2e'; -- MARIA CLARA FERREIRA FOGAÇA
UPDATE public.alunos SET codigo_sgde = '1441829' WHERE id = '66c7f9e3-53d0-4789-8f9d-fc6a33893cfe'; -- GEOVANNA SILVA BARBOSA
UPDATE public.alunos SET codigo_sgde = '1447024' WHERE id = '083482f5-d61d-4d91-afc3-b2f656f128f2'; -- BIANCA NILKY MARIANI ARAUJO
UPDATE public.alunos SET codigo_sgde = '1448059' WHERE id = 'bbe3460f-5c83-4fd6-9f25-5d53d1baeafc'; -- KAMILY VITÓRIA ROCHA AGUILHERA
UPDATE public.alunos SET codigo_sgde = '1448299' WHERE id = '1fbbcb00-47d2-4442-8105-dd27c0ad1d6b'; -- ISADORA LEITE RODI
UPDATE public.alunos SET codigo_sgde = '1449579' WHERE id = '7f49e19c-ddab-4741-b738-56052724161c'; -- ÉRIK MAZETTI SARAIVA
UPDATE public.alunos SET codigo_sgde = '1449673' WHERE id = '42b29cfb-db76-43ee-a510-d6a527a4c80e'; -- PEDRO ROMOALDO DE MORAES FLORES
UPDATE public.alunos SET codigo_sgde = '1451540' WHERE id = '5cdbcb81-189c-438e-b621-d327857fc201'; -- INGRID DA COSTA ORTIZ
UPDATE public.alunos SET codigo_sgde = '1452282' WHERE id = 'b2256527-950e-4da8-b439-eaefcdaa8f7b'; -- GABRIEL DOS SANTOS FARIAS
UPDATE public.alunos SET codigo_sgde = '1452284' WHERE id = '2b131377-b23e-4bf1-8d4d-362fa03eb2cc'; -- WESLEY DE LIMA SOARES
UPDATE public.alunos SET codigo_sgde = '1453018' WHERE id = '04eaa5e0-c573-4151-81f9-b5ac579cc675'; -- JOÃO DA COSTA MADIA
UPDATE public.alunos SET codigo_sgde = '1454211' WHERE id = '2ed6c8a0-3036-49f9-ba91-500063255105'; -- MARIA EDUARDA FELIX DE OLIVEIRA
UPDATE public.alunos SET codigo_sgde = '1455007' WHERE id = '6dc452dc-d1fd-4b4c-8e2f-140a74653786'; -- MIGUEL ÂNGELO ROCHA BUSINARO
UPDATE public.alunos SET codigo_sgde = '1456269' WHERE id = '3e28a51a-35d6-4830-9edd-260e9e021f81'; -- GUSTAVO MARÇAL ANDRADE
UPDATE public.alunos SET codigo_sgde = '1459615' WHERE id = '6baa3a97-6361-406c-9ecc-b581b406d323'; -- ANNA LUIZA RODRIGUES BARROS
UPDATE public.alunos SET codigo_sgde = '1460797' WHERE id = '969759a7-d20f-4d84-863e-3b07fa1117ee'; -- JULIA VITÓRIA PALAZZINI DE BRITO CARDOSO SANTOS
UPDATE public.alunos SET codigo_sgde = '1462834' WHERE id = '36cf01ec-e56f-4a16-8afe-fc0a9b463a94'; -- THIAGO VILA NOVA
UPDATE public.alunos SET codigo_sgde = '1465234' WHERE id = 'feddd4dd-4dbc-4061-8da1-b12804d24ad7'; -- JULLYA OLIVEIRA SILVA
UPDATE public.alunos SET codigo_sgde = '1471551' WHERE id = '6c480943-d0f2-4293-ab20-1c01b399cbe3'; -- KAUÃ PIETRO RODRIGUES CRUZ
UPDATE public.alunos SET codigo_sgde = '1471576' WHERE id = 'ce1fdbc7-093c-4513-a68f-46ddaad3ca4d'; -- EMANUELLY RODRIGUES CRUZ
UPDATE public.alunos SET codigo_sgde = '1471835' WHERE id = '0414e540-da5f-4c26-b050-3a7207f04579'; -- KAMILA ALVES DE LEÃO
UPDATE public.alunos SET codigo_sgde = '1472748' WHERE id = '85db2635-9e9a-46fe-9947-8cea3cf473e9'; -- ANTONHELLA NAZARETH MARCANO LOPEZ
UPDATE public.alunos SET codigo_sgde = '831914' WHERE id = '4dd55332-fcef-45fc-9582-e1f81f78ac28'; -- RENATA MARION BORGES GUIMARÃES
UPDATE public.alunos SET codigo_sgde = '898124' WHERE id = 'e9243170-13ea-44f8-8fef-2cfec73fa167'; -- FILIPE ANTÔNIO CASTELO SANCHES
UPDATE public.alunos SET codigo_sgde = '910088' WHERE id = '57bb9ada-2c43-49b1-a382-c3e3440c48d6'; -- GUILHERME DA ROCHA SANTOS
UPDATE public.alunos SET codigo_sgde = '957202' WHERE id = '8105511d-5668-4caf-a001-7bb96deb0cce'; -- QUEMUEL HENRIQUE COSTA EUGENIO
UPDATE public.alunos SET codigo_sgde = '1052138' WHERE id = 'e8c3c4b1-53e1-4401-b7e3-1a50efb3ee48'; -- THAÍSSA GONÇALVES OLAGAS
UPDATE public.alunos SET codigo_sgde = '1101304' WHERE id = 'e416de2a-5421-44dc-b946-b1d37c3668d0'; -- GUSTAVO FERREIRA DA SILVA
UPDATE public.alunos SET codigo_sgde = '1139057' WHERE id = 'e0794832-9590-49d4-a75f-00a0e6d3b2c6'; -- DIENIFFER LOARA MELGAREJO CABRAL
UPDATE public.alunos SET codigo_sgde = '1152577' WHERE id = '53407256-7c1b-4d10-948a-9f752b07c763'; -- BRUNO ARRUDA MUNIN
UPDATE public.alunos SET codigo_sgde = '1210502' WHERE id = 'a1eb9b90-23fa-4de4-9cde-32ed6f1d4cf4'; -- ELIAS DANIEL LIMA BAPTISTA
UPDATE public.alunos SET codigo_sgde = '1264244' WHERE id = 'e78c311f-cbba-49af-ae07-21cf63d150f8'; -- GABRIELA FERREIRA DE JESUS RIBEIRO
UPDATE public.alunos SET codigo_sgde = '1287423' WHERE id = '878b54b4-7532-4f27-84c9-4b7f546900a6'; -- NÍKOLLAS MUNIZ DOS SANTOS
UPDATE public.alunos SET codigo_sgde = '1292639' WHERE id = '0ad0e645-da0d-4730-9dfa-8078e0399c15'; -- MARIA LUIZA ESCOBAR DE SOUSA
UPDATE public.alunos SET codigo_sgde = '1297079' WHERE id = '87ec3a11-5a7a-4cbb-a65e-5829887e05ee'; -- KAIO BRENDOWN MACEDO DE OLIVEIRA SILVA
UPDATE public.alunos SET codigo_sgde = '1314153' WHERE id = '8b7601f5-60ce-425b-8fc0-3652823aacd9'; -- ADRIELLY GONÇALVES RODRIGUES
UPDATE public.alunos SET codigo_sgde = '1375993' WHERE id = '9e77926e-d92a-4e7c-bcea-3f59893e938d'; -- JESUS LUCAS PORTO NOVAIS SOLER
UPDATE public.alunos SET codigo_sgde = '1383400' WHERE id = '7a312899-56cb-4eaa-a545-7d4a8eda1b9d'; -- ANA JÚLIA FERELLI PINTO DE OLIVEIRA
UPDATE public.alunos SET codigo_sgde = '1387078' WHERE id = '71e15834-52e6-4d2e-a873-e4ed4f777a71'; -- KAIQUE DOS SANTOS BARBOSA
UPDATE public.alunos SET codigo_sgde = '1393295' WHERE id = '79e0dc34-3d3f-4585-befa-ed8d6a678e6e'; -- ANA CLARA BARBOSA DE BRITO FERREIRA
UPDATE public.alunos SET codigo_sgde = '1413873' WHERE id = '2064ae6f-0086-46fe-abdd-8d42e83c1526'; -- JOÃO FELIPE DA SILVA PEDREIRO
UPDATE public.alunos SET codigo_sgde = '1435758' WHERE id = 'a9c43172-45b7-4784-9e0b-47688d7bd0a7'; -- MARIANE DOS SANTOS ROCHA
UPDATE public.alunos SET codigo_sgde = '1445271' WHERE id = '1a744328-fc7c-4f89-a68d-15416155b8da'; -- MARJORIE CASTRO SOLER DE LIMA
UPDATE public.alunos SET codigo_sgde = '1447420' WHERE id = 'df0432e0-4e21-4571-af09-bf35692f5a33'; -- BÁRBARA CILENE SERRA NOSTÓRIO
UPDATE public.alunos SET codigo_sgde = '1450230' WHERE id = '5bc60212-d11f-4937-9d2e-7dd5fb6d1edf'; -- ABNER KALLEB DE JESUS DIAS
UPDATE public.alunos SET codigo_sgde = '1451323' WHERE id = 'aa0b561c-4af7-4a72-af10-fd1ed4c9ae4c'; -- MIKAELLA DE SOUZA CONCEIÇÃO
UPDATE public.alunos SET codigo_sgde = '1451699' WHERE id = 'df028b0d-328b-4eca-a061-96ffd0da4839'; -- SAMUEL DAVI DOS SANTOS RODRIGUES DA SILVA
UPDATE public.alunos SET codigo_sgde = '1452053' WHERE id = 'a127f56f-bc16-43ff-b459-d6ddd8c9993f'; -- HELENA VITÓRIA DE OLIVEIRA PEREIRA
UPDATE public.alunos SET codigo_sgde = '1453756' WHERE id = '7268d93f-efdb-44c9-8a04-e25f86e6d163'; -- DANIEL LUCAS MENDES NETO
UPDATE public.alunos SET codigo_sgde = '1457105' WHERE id = 'bf6b9032-db3a-4fc0-bc2b-76ae315fbad6'; -- LUIS HENRIQUE DE OLIVEIRA ARAÚJO
UPDATE public.alunos SET codigo_sgde = '1458565' WHERE id = '7e373adc-c585-42b3-a760-6bee3bdddf7e'; -- ARTHUR DANIEL DE SOUZA GARAJO
UPDATE public.alunos SET codigo_sgde = '1462911' WHERE id = '40e0854d-0b46-4231-a2fe-c7afbf04b1f7'; -- MICHELLY ELEY DE MOURA SOARES
UPDATE public.alunos SET codigo_sgde = '1463627' WHERE id = 'f33cbc00-403f-42a5-ba34-5b890594bdaa'; -- GABRIELA DOS SANTOS
UPDATE public.alunos SET codigo_sgde = '1463812' WHERE id = '9aab53a4-415c-428b-9069-4222d5ec5d8d'; -- DARA RAYNE DA SILVA ARAUJO
UPDATE public.alunos SET codigo_sgde = '1463962' WHERE id = 'ea42bfc1-dd63-47ed-86b1-6ec1a02566a5'; -- EMANUELY MEDINA
UPDATE public.alunos SET codigo_sgde = '1465083' WHERE id = '25530d05-5cc6-41e4-8807-c402789c7eb3'; -- JOHNNY SAMUEL DE MATTOS RODRIGUES
UPDATE public.alunos SET codigo_sgde = '1466642' WHERE id = 'af540da0-2e19-4323-8c25-7bc74bcdca91'; -- YASMIN ARAÚJO CHARÃO
UPDATE public.alunos SET codigo_sgde = '1467026' WHERE id = '70ecbf2e-6e59-47a7-a678-2abe32a3fd68'; -- LANNA TORRES CABREIRA
UPDATE public.alunos SET codigo_sgde = '1468995' WHERE id = 'e2fa29f2-1afc-478a-810b-2dc698221cff'; -- RAFAELLA LUCAS DE OLIVEIRA VOLTER
UPDATE public.alunos SET codigo_sgde = '1474144' WHERE id = '8d4fd14d-38cf-4969-bb2d-c265424b574a'; -- NATALIA DA SILVA PINTO
UPDATE public.alunos SET codigo_sgde = '800782' WHERE id = '67d8dfc9-d935-4a67-8aa8-b756e0a3cb12'; -- JÚLIA RAMOS PEDREIRO
UPDATE public.alunos SET codigo_sgde = '1019611' WHERE id = '60074234-ab99-46aa-9de6-4c1f2dc4727a'; -- THAMIRES DOS SANTOS GONÇALVES
UPDATE public.alunos SET codigo_sgde = '1060903' WHERE id = '211522bf-e85d-4e34-8fa9-44e467721075'; -- LUIZA MARION BORGES GUIMARÃES
UPDATE public.alunos SET codigo_sgde = '1122226' WHERE id = '1fc8f34d-9fa0-4414-8982-42bbd1010a96'; -- ELDER SILVA DE ASSIS RIBEIRO
UPDATE public.alunos SET codigo_sgde = '1140258' WHERE id = '62b4821c-6f97-4ef5-ad56-cf2e902d071f'; -- LUCAS MOREIRA RODRIGUES
UPDATE public.alunos SET codigo_sgde = '1272337' WHERE id = 'fb2055e4-700b-44d1-85cf-b2d381fe1c27'; -- MURILLO NUNES PINHEIRO
UPDATE public.alunos SET codigo_sgde = '1295120' WHERE id = '617eeefb-9571-4d97-8d57-49012886f27d'; -- ISABELLY VITÓRIA MENDONÇA FERREIRA
UPDATE public.alunos SET codigo_sgde = '1336927' WHERE id = '2520cd9e-c527-46f7-a1d5-b4446efb2bcb'; -- KAMILLY VITÓRIA GUEDES
UPDATE public.alunos SET codigo_sgde = '1372716' WHERE id = '70471337-e571-4a38-bd2b-87112f73e90c'; -- JOSÉ LUIS CONCEIÇÃO DA SILVA
UPDATE public.alunos SET codigo_sgde = '1375089' WHERE id = 'bc692ae5-5630-4f1d-8fd2-845297d9adbd'; -- JORGE HENRIQUE BRUSAMARELLO DE OLIVEIRA
UPDATE public.alunos SET codigo_sgde = '1383558' WHERE id = 'a29dca6b-f882-46ad-92ba-56c53c7a5739'; -- ANA KARLA NUNES DA SILVA
UPDATE public.alunos SET codigo_sgde = '1417623' WHERE id = '7a9ebe95-f613-4014-86bb-e62ce67d30bf'; -- SARA ORTIZ DE SOUZA FERREIRA
UPDATE public.alunos SET codigo_sgde = '1425503' WHERE id = '48302325-f90c-442d-a3fe-0c6c3135152b'; -- LEONARDO LUIZ MONSON DE OLIVEIRA
UPDATE public.alunos SET codigo_sgde = '1432186' WHERE id = '036e50e4-74c5-4e81-abf6-9cc3d6a04142'; -- RENAN PIETRO LOPES DE OLIVEIRA
UPDATE public.alunos SET codigo_sgde = '1442358' WHERE id = 'f0653d23-7abd-44d9-9b88-38d5192fe0cf'; -- CLAUDIO LUIZ SCHMITT NETO
UPDATE public.alunos SET codigo_sgde = '1442692' WHERE id = '9a5523bc-34cb-4923-abd0-9e999d8ffeaf'; -- PEDRO RANDER YULE SILVA
UPDATE public.alunos SET codigo_sgde = '1443055' WHERE id = '340eba31-9e49-4806-ad5a-4731a23c12c5'; -- HENRIQUE MOURA ARGUILERA
UPDATE public.alunos SET codigo_sgde = '1443570' WHERE id = '65c76472-04c0-4032-bb9d-b1f82be3fcc9'; -- IZADORA DE OLIVEIRA FERNANDES
UPDATE public.alunos SET codigo_sgde = '1443726' WHERE id = '7592a3a9-99df-4214-aa00-8a070a62cd8d'; -- JULIA PEIXOTO BONFIM
UPDATE public.alunos SET codigo_sgde = '1445305' WHERE id = 'f7262355-7ac2-4071-a166-33dcf368dc1f'; -- MIKAEL MENEZES FAGUNDES
UPDATE public.alunos SET codigo_sgde = '1446449' WHERE id = '3477d20c-e302-4bfd-a1ac-eec93643fad9'; -- FELIPE MENDONÇA CAETANO
UPDATE public.alunos SET codigo_sgde = '1447719' WHERE id = '0799ff0c-f6da-4cfe-bf6b-b038058e3402'; -- CIBELLY VIEIRA DE BARROS
UPDATE public.alunos SET codigo_sgde = '1448051' WHERE id = 'fa5cf0fb-6c00-4cdd-b6d0-1b0921753d4c'; -- JOÃO MARCOS CHAUSTZ BERNARDES
UPDATE public.alunos SET codigo_sgde = '1448194' WHERE id = 'eb2532c5-a094-48ba-a12b-2908be17e174'; -- JOÃO LUCAS PINHEIRO DE REZENDE
UPDATE public.alunos SET codigo_sgde = '1448304' WHERE id = '4fa12262-db72-4443-9137-a9ad4dc31c5f'; -- ANA BEATRIZ CARDOSO MARTINS
UPDATE public.alunos SET codigo_sgde = '1449204' WHERE id = '442051cb-4cd7-4b46-89d8-9d0d82d373f1'; -- ALINE BELCHIOR DA SILVA AMORIM
UPDATE public.alunos SET codigo_sgde = '1450450' WHERE id = 'c2b36a7c-dbf5-4123-a99b-49e1eed40a3f'; -- GUILHERME CHAPIESKI CAMPOS
UPDATE public.alunos SET codigo_sgde = '1453989' WHERE id = '7d827d48-fd0b-495d-9a16-b315cc43274f'; -- PIETRO OTÁVIO DA SILVA MARTINS
UPDATE public.alunos SET codigo_sgde = '1456985' WHERE id = '03f03b6c-264b-473f-9f39-19b528cd6c16'; -- RENATO SILVA DE JESUS SOUSA
UPDATE public.alunos SET codigo_sgde = '1457389' WHERE id = '079d5686-2fe2-4f87-97ae-99392828f557'; -- MARIA EDUARDA CAMARGO DE MENEZES
UPDATE public.alunos SET codigo_sgde = '1458588' WHERE id = '3cf0d9b4-de7f-4b06-8fdd-1dc8dbaedbb5'; -- ISABELLA PRADO FRANÇA
UPDATE public.alunos SET codigo_sgde = '1459854' WHERE id = '6d4f3cc2-d5fb-47d6-8a50-227062dc04f9'; -- REYNAN BATISTA DA SILVA
UPDATE public.alunos SET codigo_sgde = '1462579' WHERE id = '02056793-d72f-4c23-a767-d8ad521e851f'; -- SOFIA KETLYN CORREA BALIEIRO
UPDATE public.alunos SET codigo_sgde = '1465651' WHERE id = '4d7053f3-7643-45e1-ad4d-7db9fcc1450d'; -- DHIOGO VERÍSSIMO MONTEIRO DOS SANTOS
UPDATE public.alunos SET codigo_sgde = '1466103' WHERE id = '582576f0-d124-433f-8fc3-c04d5c99b5f4'; -- ISABELLY DE SOUZA VIEIRA DOS SANTOS
UPDATE public.alunos SET codigo_sgde = '1466305' WHERE id = '2353f2b2-8bae-4d4d-923b-512ebd1a75a1'; -- ALEXANDRE FERRO TEIXEIRA
UPDATE public.alunos SET codigo_sgde = '1467533' WHERE id = 'e72fd090-060d-412a-9576-11f7e7cea4ff'; -- KAMILLY VITÓRIA SIMPLÍCIO ROSA
UPDATE public.alunos SET codigo_sgde = '1467861' WHERE id = '6127df2f-fdaf-4f27-8591-d94650348806'; -- GABRIEL VICENTE DA PAZ SILVA
UPDATE public.alunos SET codigo_sgde = '1482145' WHERE id = 'fa8c3302-4414-4856-ad1d-464537d27d82'; -- BRUNA LOPES DA CONCEIÇÃO
UPDATE public.alunos SET codigo_sgde = '1482146' WHERE id = 'aeb22b6d-f0ec-4685-ac86-fd8dc3cd8984'; -- YASMIM GURGEL DE OLIVEIRA
UPDATE public.alunos SET codigo_sgde = '887796' WHERE id = 'e22240b4-5fef-4a3e-a546-b028c672a542'; -- CAIO HENRIQUE BATISTA DOS SANTOS
UPDATE public.alunos SET codigo_sgde = '897793' WHERE id = '567ee745-c065-4798-a9d7-4773c5ef732e'; -- VITÓRIA ALVES DOS SANTOS
UPDATE public.alunos SET codigo_sgde = '905371' WHERE id = '123ef551-defe-4738-9460-62a9e501e2b8'; -- RIAN ASTOFE MAGALHÂES
UPDATE public.alunos SET codigo_sgde = '911424' WHERE id = '24f5325a-3c3d-4d03-b28e-3464df309541'; -- JULIO CESAR FONSECA MIRANDA JÚNIOR
UPDATE public.alunos SET codigo_sgde = '918295' WHERE id = '0b379ad2-8ee8-40df-8e8f-ddd7f8c28589'; -- FELIPE GOMES CONCHE
UPDATE public.alunos SET codigo_sgde = '925875' WHERE id = '099c016a-34e0-4e49-8cac-1c2b592cae10'; -- NATIELY SOUZA DA PAZ SANTOS
UPDATE public.alunos SET codigo_sgde = '983497' WHERE id = '9bb6bcdb-4539-4603-a964-d45db779afea'; -- CAROLINE DIAS ALVES
UPDATE public.alunos SET codigo_sgde = '1018266' WHERE id = 'af37ce51-7471-4653-8c1e-30712b00b5cc'; -- JONATHAN FERREIRA DRUMOND
UPDATE public.alunos SET codigo_sgde = '1148089' WHERE id = 'e394d6d9-a5d4-4b36-8a21-a46ac1271106'; -- DÉRICK EDUARDO DUARTE PAIVA
UPDATE public.alunos SET codigo_sgde = '1266240' WHERE id = 'aae344bf-4490-45c7-8160-48422e19002b'; -- PEDRO HENRIQUE CORONEL MACEDO RIBEIRO
UPDATE public.alunos SET codigo_sgde = '1286087' WHERE id = 'f0b28b00-2615-4810-8c09-0759eb08d6be'; -- ADRYA VICTÓRIA DE LIMA CALVIS
UPDATE public.alunos SET codigo_sgde = '1289504' WHERE id = 'c2f3f11d-eca2-44bf-95e0-a2396ca0dddd'; -- KAYO ENRIK COIMBRA MIRANDA
UPDATE public.alunos SET codigo_sgde = '1296977' WHERE id = 'cf2c1f3f-e139-4cbc-b1b7-40fb29cd8528'; -- AMANDA VICTORIA TEIXEIRA ESPINDOLA
UPDATE public.alunos SET codigo_sgde = '1322452' WHERE id = '2a42d39c-1aea-4b2a-a6de-fb2f16b44b3a'; -- GUILHERME CAMPOSANO FAGUNDES
UPDATE public.alunos SET codigo_sgde = '1322901' WHERE id = '41be2d12-554b-4314-9859-c3e26f49ea41'; -- DAVI PEREIRA MORAES SANTOS
UPDATE public.alunos SET codigo_sgde = '1327611' WHERE id = '16b2a1cb-0e8c-47a3-8342-80e448ed598f'; -- ALESSANDRO MONSON DE OLIVEIRA
UPDATE public.alunos SET codigo_sgde = '1329014' WHERE id = '665ad9f8-5c5a-435d-aa4b-797756994830'; -- PIETRO NUNES DOS SANTOS
UPDATE public.alunos SET codigo_sgde = '1338303' WHERE id = '20be6b0b-943f-488f-ac98-289f23ab0293'; -- LUÍS HENRICK DOS SANTOS NASCIMENTO
UPDATE public.alunos SET codigo_sgde = '1343097' WHERE id = '9c33b751-5cbc-425f-b0fa-93cc9292e404'; -- LUIZ GUSTAVO GOMES ARCANJO
UPDATE public.alunos SET codigo_sgde = '1346244' WHERE id = '5e92bc23-322f-460b-a9f4-0b9407c8750b'; -- SAMIRAH GOMES AMARAL
UPDATE public.alunos SET codigo_sgde = '1349506' WHERE id = '9d8be49e-ecbd-466b-9f41-6d5a5172cdf6'; -- LUIZ AUGUSTO ARAUJO JAIME
UPDATE public.alunos SET codigo_sgde = '1357196' WHERE id = '90451c90-ea92-45c0-801f-aee8430d3d01'; -- LUANA BRITEZ FERREIRA
UPDATE public.alunos SET codigo_sgde = '1361803' WHERE id = '97ce3b8d-8e29-479e-bd1e-281b07e596fe'; -- SOPHIA VITÓRIA BRUSAMARELLO MORAIS
UPDATE public.alunos SET codigo_sgde = '1371620' WHERE id = '15dbe4ab-4a04-4cb4-8663-3fab13b95fbd'; -- LIDIA VITÓRIA DOS SANTOS FERREIRA
UPDATE public.alunos SET codigo_sgde = '1373583' WHERE id = '430bb4c1-6384-4a11-b82f-867014a995c5'; -- MARIA EDUARDA COUTO BARBOSA
UPDATE public.alunos SET codigo_sgde = '1398844' WHERE id = '16b45817-15a7-4b8d-820a-e1874e1a0bff'; -- JEAN CARLOS NOGUEIRA FONSECA FERREIRA
UPDATE public.alunos SET codigo_sgde = '1401426' WHERE id = 'd3c88ff5-4234-415a-998c-8ab96197acf5'; -- PAULO HENRIQUE DO PRADO TEIXEIRA
UPDATE public.alunos SET codigo_sgde = '1403313' WHERE id = '17e5b3c2-10e0-4d57-957f-9a83ac69c5d8'; -- JOAQUIM BARROSO DE ALMEIDA NETO
UPDATE public.alunos SET codigo_sgde = '1405783' WHERE id = '7de412e9-8f74-4a87-8496-6c38e36825df'; -- HENRIQUE RAFAEL DE ALMEIDA FERREIRA
UPDATE public.alunos SET codigo_sgde = '1408550' WHERE id = '0698e7f7-07c0-4c14-9bb0-b33032eae857'; -- NATÁLIA DE SOUZA LIMA
UPDATE public.alunos SET codigo_sgde = '1409061' WHERE id = '24f349c5-b4ac-4937-8bab-6099a5e088e4'; -- ANNE ELISY CACERES FERREIRA
UPDATE public.alunos SET codigo_sgde = '1412981' WHERE id = 'e5be74b7-a697-4e87-b8ac-0d2c045eef0f'; -- GUILHERME GABRIEL CARDENA DE JESUS
UPDATE public.alunos SET codigo_sgde = '1415950' WHERE id = 'bd3dec17-d7dc-4f63-9666-e0cf10691137'; -- RAFAELY LOHAYNE DE MOURA CARVALHO
UPDATE public.alunos SET codigo_sgde = '1416137' WHERE id = '42b97291-d969-4796-bc11-b59defa1100b'; -- EMANUELLY BEATRIZ CARDOSO DOS SANTOS
UPDATE public.alunos SET codigo_sgde = '1422108' WHERE id = '86fd6792-6425-4a2a-b829-e94b79c8da61'; -- KEYSLER PEREIRA PILENGHI
UPDATE public.alunos SET codigo_sgde = '1424175' WHERE id = 'e2602e74-edf5-479c-a167-750033f33189'; -- ERICK HENRIQUE VALEJO DA SILVA
UPDATE public.alunos SET codigo_sgde = '1438620' WHERE id = '8046a8d6-4f7d-4713-9d32-dfa871b479b4'; -- JULIANE RODRIGUES DE SOUSA
UPDATE public.alunos SET codigo_sgde = '1484701' WHERE id = '2c4cf32c-188c-4082-93a5-94b259eb8232'; -- MARIA EDUARDA VILALBA PEREIRA
UPDATE public.alunos SET codigo_sgde = '907525' WHERE id = '0f74286a-c7bc-42fa-94ef-0b4a00771714'; -- DANIEL AUGUSTO LOPES MORETTO
UPDATE public.alunos SET codigo_sgde = '908357' WHERE id = '317c70f4-66c5-4fb9-bef7-c75cd87c3cd8'; -- GUILHERME HENRIQUE DOS SANTOS BARBIERO
UPDATE public.alunos SET codigo_sgde = '961958' WHERE id = 'd73b4d9f-f14d-4598-a2e2-1bcd0eaa4c5a'; -- LUCAS JEFERSON FLORENCIO COSTA
UPDATE public.alunos SET codigo_sgde = '969333' WHERE id = '60ec62df-f874-4174-b93d-59cf7f748cf8'; -- ISABELLI BORTOLINI ALVES
UPDATE public.alunos SET codigo_sgde = '1045418' WHERE id = '81ac4806-42e5-4a99-97c7-5633c9f5ee37'; -- VICTOR MORAES DOS SANTOS
UPDATE public.alunos SET codigo_sgde = '1045935' WHERE id = 'd790efc1-b2a2-49d6-a100-16ddb1fd52ca'; -- SAMARA ORTEGA SILVA
UPDATE public.alunos SET codigo_sgde = '1045949' WHERE id = '3ec36fd0-2ba3-42f7-990c-f02fe408b44f'; -- SAMIRA ORTEGA SILVA
UPDATE public.alunos SET codigo_sgde = '1047670' WHERE id = '2ad1c96d-cb66-41b7-815e-a19a462ef10c'; -- HELOÍSA QUEROBIM JOVELLONE
UPDATE public.alunos SET codigo_sgde = '1235736' WHERE id = '1f503b68-6745-40c6-93fe-286b337cb9f4'; -- MYLENA GABRIELLA VASCONCELOS DA SILVA
UPDATE public.alunos SET codigo_sgde = '1236295' WHERE id = 'ce83962f-ca8f-4380-9a3b-947041c79514'; -- PIETTRO CARVALHO SILVA
UPDATE public.alunos SET codigo_sgde = '1258106' WHERE id = '2cd54205-4bc1-4aa2-aea1-4dd912dcf970'; -- BRENDA VITÓRIA ZAVALA NUNES
UPDATE public.alunos SET codigo_sgde = '1260190' WHERE id = '3c4945ff-b90b-432e-9b92-67f6e6e43aa6'; -- GIOVANNA BATISTA LINO
UPDATE public.alunos SET codigo_sgde = '1268986' WHERE id = '05a0c364-c6b2-4d24-a3ba-952448d66a70'; -- NADIELLY PRADO DE ALMEIDA
UPDATE public.alunos SET codigo_sgde = '1296696' WHERE id = 'ed67bf3c-4e18-43fd-a897-2e410032e3cd'; -- SIBELY FERREIRA MARTINS
UPDATE public.alunos SET codigo_sgde = '1298742' WHERE id = '3002399b-fbc3-470d-83d7-57d48322263e'; -- CRISTINE AREVALO INHAIA
UPDATE public.alunos SET codigo_sgde = '1316194' WHERE id = '6c24873c-697f-4b11-addc-dc83ef5e531a'; -- MARIA ISABEL LEAL DOS SANTOS
UPDATE public.alunos SET codigo_sgde = '1320887' WHERE id = 'a7630a02-451d-4e75-b525-431ad9892961'; -- ISABELA AMORIM SANCHEZ
UPDATE public.alunos SET codigo_sgde = '1321549' WHERE id = '711edb58-9193-40f2-ba8f-68dd59a36d70'; -- ELLEN SOFIA DE OLIVEIRA DANTAS
UPDATE public.alunos SET codigo_sgde = '1327092' WHERE id = 'cf20907b-d18c-4ce6-98b9-5372e49d1260'; -- PEDRO GUILHERME PEDROZA GOMES
UPDATE public.alunos SET codigo_sgde = '1330846' WHERE id = '52bb4558-6083-481f-9650-2b3667fd7f3a'; -- ELOAH DE LARA PEREIRA
UPDATE public.alunos SET codigo_sgde = '1332512' WHERE id = '1776694b-cbba-45e4-a70a-3c69e351f45e'; -- KETELLYN DE SOUZA GONÇALVES
UPDATE public.alunos SET codigo_sgde = '1350034' WHERE id = '7fc15a38-208c-4281-a7e4-4b9344cb90b6'; -- BRUNO MARCANZONI NONENMACHER
UPDATE public.alunos SET codigo_sgde = '1351931' WHERE id = '6bac485e-b7be-4ee2-9a81-88b369e6524e'; -- RAPHAEL DE SOUZA DA SILVA
UPDATE public.alunos SET codigo_sgde = '1366497' WHERE id = 'f7458a38-d858-4da8-89cf-ab99edca2566'; -- ISABELLY ORQUÍDEA MARTINS SILVA
UPDATE public.alunos SET codigo_sgde = '1386428' WHERE id = 'b73fdc83-ba04-4015-99e5-3903d3bae6ed'; -- LORENA AUBRY PELEGRINI DO CARMO
UPDATE public.alunos SET codigo_sgde = '1386600' WHERE id = '6a43d0b3-3415-418b-b34e-fd6255c73be4'; -- FELIPE EMANUEL FRUTUOSO CÁCERES
UPDATE public.alunos SET codigo_sgde = '1389219' WHERE id = 'fea09f7e-a2db-4a0b-923e-77cf07bbe1f5'; -- ANNA LUIZA LOURENÇO DA SILVA DE JESUS LUCAS
UPDATE public.alunos SET codigo_sgde = '1396796' WHERE id = 'ee5da041-0b1f-4391-93bf-10f930a5fd5e'; -- RYAN KAIO FEDERIGI DANTAS
UPDATE public.alunos SET codigo_sgde = '1397452' WHERE id = 'cc569ac8-9ab7-41bc-b9bc-8065f3ad36a9'; -- JOÃO VICTOR DA SILVA MORAES
UPDATE public.alunos SET codigo_sgde = '1409926' WHERE id = '23fd6ce2-eb00-486b-8eb3-ebc24e08cbb4'; -- RAPHAEL DE LARA CORRÊA
UPDATE public.alunos SET codigo_sgde = '1410799' WHERE id = 'fd7ed18a-1e51-4bef-9335-a675f5fff0ef'; -- IZADORA PEREIRA DA SILVA
UPDATE public.alunos SET codigo_sgde = '1411494' WHERE id = '241ce7a0-f91f-4732-98e1-0c275761955c'; -- RAONY RIAN DE SOUSA RIBEIRO
UPDATE public.alunos SET codigo_sgde = '1412729' WHERE id = '3e41d89d-344b-4948-8f1c-65e86cb6a0b3'; -- LEONARDO DE ALMEIDA OLIVEIRA
UPDATE public.alunos SET codigo_sgde = '1417704' WHERE id = '3282ac98-3271-46a9-a6fc-dd68d118dfc6'; -- MARIA JÚLIA SIBEMOL MASCARENHAS BEZERRA
UPDATE public.alunos SET codigo_sgde = '831027' WHERE id = '56c6de52-5202-4a18-b3bb-838bea726ce7'; -- DIEGO DE OLIVEIRA REGINALDO
UPDATE public.alunos SET codigo_sgde = '866064' WHERE id = '097407c2-b1a1-48e4-9e1e-36e3432cfdd4'; -- FRED GONÇALVES MARTINS JUNIOR
UPDATE public.alunos SET codigo_sgde = '909389' WHERE id = '9864138c-0538-4917-9128-f94896446db0'; -- HAYLLA EMANUELY TORRES DE OLIVEIRA
UPDATE public.alunos SET codigo_sgde = '913355' WHERE id = 'a8f7010c-2e15-4c6f-87b4-061ab0fff2c4'; -- MIGUEL DA SILVA CAVALCANTE
UPDATE public.alunos SET codigo_sgde = '919915' WHERE id = '7fea651e-b5c6-417a-b062-905cb01a6eef'; -- MYLLENA DE ALMEIDA ROSARIO
UPDATE public.alunos SET codigo_sgde = '945683' WHERE id = '46751d6e-394d-49ab-96b1-b54997973246'; -- EMILLY ALMEIDA RODRIGUES
UPDATE public.alunos SET codigo_sgde = '954498' WHERE id = '8827093e-0ca8-4286-868a-586082bd8107'; -- GUSTAVO DE SOUZA SALES
UPDATE public.alunos SET codigo_sgde = '960653' WHERE id = '4755bd64-2627-4298-adec-81bf255e7918'; -- PHABLO ROBERTO  GAUNA  PINHEIRO
UPDATE public.alunos SET codigo_sgde = '961283' WHERE id = '51d0e6d7-4957-48a5-981c-3bdb0de9233d'; -- PEDRO COSTA BARBOSA
UPDATE public.alunos SET codigo_sgde = '1095713' WHERE id = '028dee4a-25b3-414c-95d8-8bcdc7c0871e'; -- DIEGO VAEZ HIGA
UPDATE public.alunos SET codigo_sgde = '1183428' WHERE id = '48ab1f4b-7a6a-4328-893c-7e71fe585104'; -- LUKAS SILVESTRE CHILAVIER
UPDATE public.alunos SET codigo_sgde = '1210796' WHERE id = '59c9c628-a588-4108-9d0a-481a502c4f84'; -- LAÍS AVILA DA SILVA
UPDATE public.alunos SET codigo_sgde = '1255487' WHERE id = '5b19099b-55a8-4c90-b168-21d68642fda9'; -- OTÁVIO SILVA DOS SANTOS
UPDATE public.alunos SET codigo_sgde = '1255512' WHERE id = 'e3fe42b0-1257-450f-ac62-bcf67a5368e4'; -- HEITOR SILVA DOS SANTOS
UPDATE public.alunos SET codigo_sgde = '1292924' WHERE id = '86c9a251-b304-4e85-9bc0-1b73999994eb'; -- RENAN ALVES PAZETO
UPDATE public.alunos SET codigo_sgde = '1293962' WHERE id = '9a074c34-2b0b-4d2a-8724-59570a3ef044'; -- NICOLAS SILVA COSTA
UPDATE public.alunos SET codigo_sgde = '1315298' WHERE id = '8f38d396-b550-48d4-ae1e-f2259da7d6e0'; -- ELOIZA ALMEIDA DE OLIVEIRA
UPDATE public.alunos SET codigo_sgde = '1328777' WHERE id = 'c7222ce4-1842-426b-b2f6-d3bbd9c61e8f'; -- KAYKE HENRIQUE CABRAL AQUINO
UPDATE public.alunos SET codigo_sgde = '1342532' WHERE id = 'cf667b78-a5c4-40b6-83e5-3b64847c0df0'; -- LUAN RICARDO SILVA DE OLIVEIRA
UPDATE public.alunos SET codigo_sgde = '1346347' WHERE id = '2d6224e9-24a9-4b68-919c-8eb6f961ff13'; -- GABRIEL MARQUES CORTES
UPDATE public.alunos SET codigo_sgde = '1355329' WHERE id = '7be802ca-051b-470c-9b75-5444226358ba'; -- THYAGO HENRIQUE SILVA SANTOS
UPDATE public.alunos SET codigo_sgde = '1358657' WHERE id = '8af4bcfa-b5b1-46ee-b2e0-342067f17230'; -- LEANDRO HENRIQUE KNOPP SILVA
UPDATE public.alunos SET codigo_sgde = '1364829' WHERE id = '791534c8-7fb7-45bd-8c55-1ae578479ded'; -- BRAYAN ROCHA PEDREIRO
UPDATE public.alunos SET codigo_sgde = '1379815' WHERE id = 'dc2008cc-a613-4b25-bcd4-ef2760ab6a07'; -- LARYSSA BEATRYZ  CORONEL RIBEIRO
UPDATE public.alunos SET codigo_sgde = '1397276' WHERE id = '9f200c87-5080-4926-866d-9a75fd02a88d'; -- CAUÃ RICARDO FONTOURA PAIM ALMEIDA
UPDATE public.alunos SET codigo_sgde = '1397565' WHERE id = '152a808d-9f9e-4dba-8bd0-344baf83c6bc'; -- GUSTAVO PINHEIRO DA SILVA
UPDATE public.alunos SET codigo_sgde = '1398382' WHERE id = '7a8eae2f-008d-4606-adaf-6d78272153a5'; -- MATHEUS VÍTOR SILVA DOS SANTOS
UPDATE public.alunos SET codigo_sgde = '1403658' WHERE id = '6feedac5-c28b-4a7b-8c06-807de147caf8'; -- ISADORA RIBEIRO DE AMORIM
UPDATE public.alunos SET codigo_sgde = '1403757' WHERE id = 'b1bd16a4-8388-4fab-b7d1-e2ad177d2dd8'; -- RICARDO DE AZEVEDO SCHIPFER DE JESUS
UPDATE public.alunos SET codigo_sgde = '1404455' WHERE id = '7c18e75e-9ac0-4136-b069-8ff2dcb9f232'; -- MAXUEL DOS SANTOS OLIVEIRA
UPDATE public.alunos SET codigo_sgde = '1408664' WHERE id = 'b822b382-e836-47c8-a04f-356b256e50c8'; -- MANUELLY FELIX FERREIRA
UPDATE public.alunos SET codigo_sgde = '1410729' WHERE id = '3189780b-ca90-4490-acf7-d01c822a1185'; -- LUIS FERNANDO OLIVEIRA DA SILVA
UPDATE public.alunos SET codigo_sgde = '1417687' WHERE id = '352272f0-ba77-489a-b89b-45f15229fca8'; -- NICOLLY SENEGAGLEA PINOTTI
UPDATE public.alunos SET codigo_sgde = '1419031' WHERE id = '2398e981-345f-460f-9a9a-4b622631bc82'; -- PEDRO HENRIQUE RODRIGUES DE SOUSA (STELLA RODRIGUES DE SOUSA )
UPDATE public.alunos SET codigo_sgde = '1439139' WHERE id = '80a2050a-3074-4a1e-a0ed-4b8917469af4'; -- ORACIO QUINTANA JUNIOR
UPDATE public.alunos SET codigo_sgde = '844791' WHERE id = '52a74f75-e037-448b-a6eb-d85474ce47a8'; -- GABRIELA LEMES GOMES
UPDATE public.alunos SET codigo_sgde = '846608' WHERE id = '0a5c5dcb-1559-470d-af3a-b0654d0d1fd5'; -- CLEITON DA SILVA MATOS
UPDATE public.alunos SET codigo_sgde = '846610' WHERE id = '6ce6e15e-c1e5-4f60-a807-b215aaf763b9'; -- MANOEL DA SILVA MATOS
UPDATE public.alunos SET codigo_sgde = '923504' WHERE id = '79cf4bc0-aa5f-4ebd-bfad-ec605548907f'; -- ISABELA CANDIA RODRIGUES MALHEIROS
UPDATE public.alunos SET codigo_sgde = '955850' WHERE id = 'a0197481-f0ab-4176-a12d-7aa69482661a'; -- NATHÁLIA TOLEDO ROCHA
UPDATE public.alunos SET codigo_sgde = '977691' WHERE id = '141612b2-5988-4115-b32b-d2f7e1a58577'; -- VINÍCIUS NUNES HADDAD
UPDATE public.alunos SET codigo_sgde = '1212408' WHERE id = '6b761005-7231-44e5-9c6f-bff8eba80178'; -- KAUÃ CATELAN NASCIMENTO
UPDATE public.alunos SET codigo_sgde = '1230535' WHERE id = '3d7b9575-4859-46de-b82d-4b481a4aa8e8'; -- ALBERT WESKER DA ROSA OLIVEIRA BORGES
UPDATE public.alunos SET codigo_sgde = '1234700' WHERE id = '908a4045-82dc-486f-a4b7-f9cf9adca7e5'; -- CLARA KAORI DE SOUZA HIROTA
UPDATE public.alunos SET codigo_sgde = '1271619' WHERE id = '80eab18d-de08-44ad-a4fa-25dae437d208'; -- LUCAS GUILHERME DA SILVA SANTOS
UPDATE public.alunos SET codigo_sgde = '1313952' WHERE id = '313cd7b2-a381-4f31-8ffc-d636912839fc'; -- NÁTHALY GOMES DA SILVA
UPDATE public.alunos SET codigo_sgde = '1315334' WHERE id = 'd5921386-3862-4bef-84a8-29349d008063'; -- ALYCE FRANCINE VAZ CARLOS
UPDATE public.alunos SET codigo_sgde = '1316514' WHERE id = '747589fc-432b-4c5d-9fdb-2382c485d559'; -- FELIPE MACIEL ROSA
UPDATE public.alunos SET codigo_sgde = '1327198' WHERE id = 'f9407b03-366a-4fbb-b324-827cd491e240'; -- GABRIEL SERAFIM SALES
UPDATE public.alunos SET codigo_sgde = '1353510' WHERE id = '7b944238-c4b2-4bd9-bc98-1883a11c127d'; -- FRANCIELI VITÓRIA ROCHA FERREIRA
UPDATE public.alunos SET codigo_sgde = '1353514' WHERE id = '368c9148-bfda-4ef8-b870-81c413b39c61'; -- ESTER VITÓRIA DE LIMA COIMBRA
UPDATE public.alunos SET codigo_sgde = '1356108' WHERE id = '6bb8b825-3e87-49b4-97b6-00a8bf1349c2'; -- KALEL WILLIAN PALHANO LOUREIRO
UPDATE public.alunos SET codigo_sgde = '1361138' WHERE id = 'c3db7462-503a-4c4a-a132-4260ed2466ba'; -- BRUNO CESAR BARBOSA DA SILVA
UPDATE public.alunos SET codigo_sgde = '1362022' WHERE id = 'ebea2caf-4e30-4966-977b-243aeb416ace'; -- MIGUEL BARRETO DOS SANTOS
UPDATE public.alunos SET codigo_sgde = '1363287' WHERE id = '86dcdabc-f9ab-4bd3-8cd2-8d3f26272ebe'; -- CARLOS EDUARDO SOUZA SANTOS
UPDATE public.alunos SET codigo_sgde = '1364187' WHERE id = '7eff3ff5-d2de-4636-a3dd-78d8069bbf4c'; -- LEÔNIDAS NUNES DE OLIVEIRA
UPDATE public.alunos SET codigo_sgde = '1366162' WHERE id = '1351ab8b-29e3-487a-8332-43531f2e123d'; -- WILHAN ALVES DE LIMA
UPDATE public.alunos SET codigo_sgde = '1367364' WHERE id = 'a0064b35-888d-45ab-9b89-a17369673efe'; -- IZABELLA HELLEN DA SILVA
UPDATE public.alunos SET codigo_sgde = '1367944' WHERE id = '28339fbe-39f0-435a-a203-dd05358db481'; -- HELOISA PEREIRA MARQUES FERREIRA
UPDATE public.alunos SET codigo_sgde = '1371242' WHERE id = 'aea2fdd4-5e0c-433b-a73d-96f400d311c0'; -- LUCIANO LEANDRO
UPDATE public.alunos SET codigo_sgde = '1372962' WHERE id = 'd0bca877-75c2-4074-8a6f-e232b46a1930'; -- RENATO VILAS MEDEIROS
UPDATE public.alunos SET codigo_sgde = '1374382' WHERE id = 'd7a56465-4e8c-499e-ba93-95222334aec2'; -- YASMIM GAMARRA MENDES
UPDATE public.alunos SET codigo_sgde = '1376308' WHERE id = '1a4ae0bc-f530-447b-abd5-0e59f23314ca'; -- ARTHUR HENRIQUE FURTADO DE ARAUJO
UPDATE public.alunos SET codigo_sgde = '1388273' WHERE id = '594b94fc-374e-4dd5-bd04-9a12b05952c0'; -- YASMIN VITÓRIA SANTOS MACEDO
UPDATE public.alunos SET codigo_sgde = '959536' WHERE id = '23980f76-0552-4a6e-919b-b11e51a86317'; -- VÍTOR HUGO VIEIRA SAMBRANA
UPDATE public.alunos SET codigo_sgde = '1167167' WHERE id = '764b14ac-b527-4ff3-b624-13287777505e'; -- PEDRO HENRIQUE SANTOS PEREIRA
UPDATE public.alunos SET codigo_sgde = '1226507' WHERE id = '3d4243a7-3d75-4168-9b6f-a9fbed8c66c1'; -- GABRIELE LOURENÇO RAMALHO
UPDATE public.alunos SET codigo_sgde = '1230712' WHERE id = '93ed791c-6e88-426e-9642-38ad963df4f9'; -- DEYVID RYAN MARTINEZ XAVIER
UPDATE public.alunos SET codigo_sgde = '1237335' WHERE id = '79cd0851-fe51-4642-93a1-21bd92b3188e'; -- ANA LUISA VIANA GERALDI
UPDATE public.alunos SET codigo_sgde = '1263069' WHERE id = '71ef4d5a-7f88-4073-9c4a-571a5f24de91'; -- BRUNO CASTRO LIMA GAUNA
UPDATE public.alunos SET codigo_sgde = '1264248' WHERE id = '256ba018-a709-4a29-b51d-66560b97a77a'; -- KLARICY FERREIRA DE JESUS RIBEIRO
UPDATE public.alunos SET codigo_sgde = '1271665' WHERE id = '75561120-aae8-4eb3-b42e-077bee6f3b2a'; -- MARIA RHAYSSA PAULINO GOMES
UPDATE public.alunos SET codigo_sgde = '1315383' WHERE id = '5f1b09e1-0892-4939-95e3-a120efd964d8'; -- LUIS FELIPE NOGUEIRA VILLALBA
UPDATE public.alunos SET codigo_sgde = '1318024' WHERE id = '5e8b8f53-4eb9-4bac-bbe0-0addec6efbe1'; -- ISADORA HOLANDA CASTILHO
UPDATE public.alunos SET codigo_sgde = '1319187' WHERE id = 'ba46eba8-fcf2-4118-80a1-038f820707fc'; -- MILLENY PEREIRA DOMINGOS CASTILHO
UPDATE public.alunos SET codigo_sgde = '1337549' WHERE id = 'fb2fdea0-5d07-4950-aa76-e0aa92e86d08'; -- LAUANE VALENTE FERREIRA
UPDATE public.alunos SET codigo_sgde = '1350682' WHERE id = '02aba96f-cc2e-4e86-95d7-c68972c71d7e'; -- PEDRO HENRIQUE DE OLIVEIRA CAMPOS
UPDATE public.alunos SET codigo_sgde = '1353084' WHERE id = '3ba591be-56b2-4650-880d-6cf3d7a76c83'; -- ELOAH FERRAZ BRAGA AGUIRRE
UPDATE public.alunos SET codigo_sgde = '1353413' WHERE id = '1289b51e-66e7-49c6-a1c0-771a70ea3810'; -- VINICIUS FRÔES DA SILVA
UPDATE public.alunos SET codigo_sgde = '1354344' WHERE id = '4bfdbdd1-e1b0-424f-85fe-31c7de9706bc'; -- GUSTAVO MARTINS ALVES DE MELO
UPDATE public.alunos SET codigo_sgde = '1355149' WHERE id = '71d4bdbf-285d-4967-8961-c199e27c6bd3'; -- MATEUS TEIXEIRA FERREIRA
UPDATE public.alunos SET codigo_sgde = '1355250' WHERE id = '2c1ecd8c-df14-4b23-9cae-2eeff85dac10'; -- ELIMARCOS GODOY FERREIRA
UPDATE public.alunos SET codigo_sgde = '1356625' WHERE id = '1e8f3545-d8e3-4812-891f-420692c7ca52'; -- TAUANY LIMA DE SOUZA
UPDATE public.alunos SET codigo_sgde = '1357668' WHERE id = '78766c2b-1edf-4ac3-a966-c3652a49942d'; -- JENEFER MARIA DE MELO
UPDATE public.alunos SET codigo_sgde = '1358939' WHERE id = 'ba146cb2-9194-4322-bad6-889fe081d843'; -- JACKELINE RODRIGUES MEDEIROS
UPDATE public.alunos SET codigo_sgde = '1359143' WHERE id = 'e36f0d5b-298a-402a-b52d-2faea6239e40'; -- MARIA VITÓRIA DIAS DA SILVA
UPDATE public.alunos SET codigo_sgde = '1366346' WHERE id = 'a8060a79-456f-49ba-ae17-d5c1fac01c46'; -- VICTOR ESPÍNDOLA  ALVES
UPDATE public.alunos SET codigo_sgde = '1367350' WHERE id = '553b4c11-1153-43bd-8af2-5a4129f688a1'; -- ANGELA CRISTINA DOS SANTOS PACO
UPDATE public.alunos SET codigo_sgde = '1369950' WHERE id = '45d37d6c-9e57-498a-8878-e80260f8d881'; -- ESTEVAM RIBEIRO NETO
UPDATE public.alunos SET codigo_sgde = '1371298' WHERE id = 'ddc841f2-a21f-434e-886b-966ca9ca4075'; -- INGRID CÁCERES GOMES
UPDATE public.alunos SET codigo_sgde = '1373734' WHERE id = 'ce1651e7-ddac-4840-a64b-78eb0b0fd3c4'; -- EDUARDO BORBA FIGUEIREDO DOS SANTOS
UPDATE public.alunos SET codigo_sgde = '1376994' WHERE id = '1d871edd-0753-447b-8818-5a1f278ae32b'; -- THAILYNE VITÓRIA DOS SANTOS TEIXEIRA
UPDATE public.alunos SET codigo_sgde = '885846' WHERE id = 'afc8124a-a676-4a62-b5d4-9be17cac60f5'; -- JOÃO MIGUEL ANASTACIO DE ASSIS
UPDATE public.alunos SET codigo_sgde = '1363790' WHERE id = 'db9bffea-cb3e-4d95-b036-9c1c875ed7a9'; -- SARA DIAS DE ALMEIDA
UPDATE public.alunos SET codigo_sgde = '1378057' WHERE id = 'ef0b5d42-d4c1-46a1-9787-704a0aa35209'; -- ISABELLY VITÓRIA MELGAR RIBEIRO
UPDATE public.alunos SET codigo_sgde = '1408208' WHERE id = '0db6c47f-3cdc-4782-af18-7c1549821273'; -- YASMIN VALENTINA PINHEIRO DA SILVA
UPDATE public.alunos SET codigo_sgde = '1426652' WHERE id = '672d067d-bc01-4463-b468-0dff6fbf446a'; -- MARCELA ANGELO CARDOSO DE MOURA
UPDATE public.alunos SET codigo_sgde = '1432890' WHERE id = '939d10fb-2974-4172-9d8e-86d0224a7d60'; -- GABRIEL DA SILVA ANTUNES
UPDATE public.alunos SET codigo_sgde = '1438681' WHERE id = '8f302b75-256c-455c-b2b7-ad65fa05f72c'; -- ANNA JÚLIA FERREIRA
UPDATE public.alunos SET codigo_sgde = '1441452' WHERE id = 'c0edb4e6-5828-43e0-8b60-f47d1418573f'; -- EDUARDO DA CRUZ CORRÊA NETO
UPDATE public.alunos SET codigo_sgde = '1441757' WHERE id = '19fdee69-f21a-4267-b9c0-2de7790cb157'; -- LUIZ ANTONIO DOS SANTOS RIBEIRO
UPDATE public.alunos SET codigo_sgde = '1444508' WHERE id = '14adb3fd-7b54-4edc-9e83-b98bafe5c74c'; -- RAY FELIPE BATISTA GOMES
UPDATE public.alunos SET codigo_sgde = '1445593' WHERE id = '1366cbf7-c6b0-474a-a600-469c12c9878c'; -- CARLOS EDUARDO MACÊDO FERREIRA
UPDATE public.alunos SET codigo_sgde = '1445626' WHERE id = '314d25ba-5ba4-481f-b66c-13eae175dda4'; -- CARLOS HENRIQUE MOREIRA PALANCIO
UPDATE public.alunos SET codigo_sgde = '1448122' WHERE id = '5d25e325-5b6a-45de-9a42-0d2829415cf6'; -- MIGUEL LINO DOS SANTOS KINOSITA
UPDATE public.alunos SET codigo_sgde = '1448181' WHERE id = '2bf3b20e-9254-4acb-9013-dccd9d65a9f3'; -- ISABELLY FERNANDES LIMA
UPDATE public.alunos SET codigo_sgde = '1451341' WHERE id = 'b3fcda8f-b58b-4c6f-a119-91c005f2f29a'; -- MIRELLA DE SOUZA CONCEIÇÃO
UPDATE public.alunos SET codigo_sgde = '1451406' WHERE id = 'ad2b680e-b74c-42cc-9c9f-4390aa5ea7c9'; -- GUSTAVO FRANCOLINO FRANÇA
UPDATE public.alunos SET codigo_sgde = '1451613' WHERE id = 'bfce1cbf-8ebd-499f-87dd-7cd424feb654'; -- GUILHERME RODRIGUES COSTA
UPDATE public.alunos SET codigo_sgde = '1452347' WHERE id = '158a909f-cdd4-44c4-9793-78ad38713faf'; -- MARIA HELOISA NASCIMENTO BARBOSA
UPDATE public.alunos SET codigo_sgde = '1454727' WHERE id = '97e06a37-fd75-46be-a29f-f77d87481201'; -- GABRIEL SILVA SANTELA
UPDATE public.alunos SET codigo_sgde = '1456407' WHERE id = 'e3c01fe3-fa6d-4ac3-b357-31315b8b70cb'; -- SOFIA BARBOSA BORGES DA SILVA
UPDATE public.alunos SET codigo_sgde = '1456978' WHERE id = '3f4aed2b-8307-477e-a96b-0c419b8de5ae'; -- VINICIUS FERREIRA RODRIGUES
UPDATE public.alunos SET codigo_sgde = '1462584' WHERE id = 'f01eaf07-19a0-4969-8806-f9698f64fece'; -- ARTHUR LOBO PEREIRA EONCONI
UPDATE public.alunos SET codigo_sgde = '1464319' WHERE id = '3b50c18a-b903-4b8c-8eaf-9701c67f5cfc'; -- DIEGO NOGUEIRA FOGAÇA
UPDATE public.alunos SET codigo_sgde = '1467208' WHERE id = '0801d87b-ed50-4742-9be8-5c7770af0c22'; -- JOÃO GABRIEL BARBOSA MARTINS
UPDATE public.alunos SET codigo_sgde = '1468110' WHERE id = '4bd8e78c-a20a-4aa5-9ea4-a8bb39b1bbe7'; -- MILENA MEDEIRO LIMA
UPDATE public.alunos SET codigo_sgde = '1468518' WHERE id = 'a7a1d5f7-99d9-4a39-9c04-a924b7dd9c0f'; -- ALICY YASMYN SAAB CABRAL DE REZENDE SANTANA
UPDATE public.alunos SET codigo_sgde = '1470026' WHERE id = 'dc8bc6aa-be40-4c6c-ae1f-395f9fb9ab86'; -- DANIEL HENRIQUE GONÇALVES SOVERNIGO
UPDATE public.alunos SET codigo_sgde = '1470154' WHERE id = '16e506cb-e22f-4064-bdc0-fda385cba67b'; -- JOSÉ GABRIEL MACHADO VALDEZ CHAGAS
UPDATE public.alunos SET codigo_sgde = '1470178' WHERE id = 'fcba25d5-a972-4652-8d82-dcfdfe21cce1'; -- LETICIA WEILLER MOURA
UPDATE public.alunos SET codigo_sgde = '1470326' WHERE id = 'fa7b2888-c15d-4e12-ad76-d1c85e92462d'; -- ADRYAN JOSÉ RIBEIRO ZAGHI
UPDATE public.alunos SET codigo_sgde = '1470972' WHERE id = '95487814-462d-4b71-a1de-aa5f6083b837'; -- ANTONIA PACHECO BARBOSA DOS SANTOS
UPDATE public.alunos SET codigo_sgde = '1471166' WHERE id = 'b75677eb-315b-46cd-b3fb-27b662067094'; -- EMANUEL DAVI CORRÊA DE ALMEIDA BARBOSA
UPDATE public.alunos SET codigo_sgde = '1471185' WHERE id = '7c69090d-05d8-4681-885e-a6c8023d9402'; -- SOFIA BEATRIZ DA SILVA RIBEIRO
UPDATE public.alunos SET codigo_sgde = '1473491' WHERE id = '6201290b-921f-4457-bc5d-f95d3e25e228'; -- EMANUELLY SOUZA SILVA
UPDATE public.alunos SET codigo_sgde = '1474610' WHERE id = '3e0d750b-ddec-4337-a43f-5f2bb20f8611'; -- YAN RAFAEL LOPES NUNES
UPDATE public.alunos SET codigo_sgde = '1475617' WHERE id = 'f6b4a3d8-fc4a-4f13-950e-93d067fa4d0d'; -- SAMAYRA SOARES FERNANDES
UPDATE public.alunos SET codigo_sgde = '1475769' WHERE id = '80affe38-a105-4b35-a6f0-a33dff345333'; -- ARTHUR AUBRY PELEGRINI HERNANDES
UPDATE public.alunos SET codigo_sgde = '1479882' WHERE id = '8f19dce1-bde1-4ffc-bc59-bf0ada6a9e6a'; -- BEATRIZ SILVA CIMATTI
UPDATE public.alunos SET codigo_sgde = '1482938' WHERE id = '682b58fb-48ac-4301-afab-568f289b750c'; -- LEANDRO GODOI DA SILVA
UPDATE public.alunos SET codigo_sgde = '1485609' WHERE id = '889b8b9e-0178-4a89-9ae4-b420e18537bd'; -- EMILY RENATA SOARES FRANCO
UPDATE public.alunos SET codigo_sgde = '1213880' WHERE id = '823c10d7-5a64-43f5-b3a1-431def71e8bc'; -- LAVÍNIA CASSIMIRO DEL GRANDE
UPDATE public.alunos SET codigo_sgde = '1351644' WHERE id = 'f3fb8dce-80f1-4f22-acaf-e23877c1fded'; -- JOÃO PAULO GONÇALVES PEREIRA
UPDATE public.alunos SET codigo_sgde = '1360837' WHERE id = '48cc51ba-4ca4-4521-852c-480ecaeb0514'; -- EMILI DE DEUS DA SILVA
UPDATE public.alunos SET codigo_sgde = '1374240' WHERE id = 'e0a2551b-e328-4820-b1f9-8068ef228c42'; -- MARIANA FLORENCIO COSTA
UPDATE public.alunos SET codigo_sgde = '1390000' WHERE id = 'ad725477-714c-46d3-a953-d39479842acc'; -- MARIANA ROMERO OVANDO
UPDATE public.alunos SET codigo_sgde = '1390262' WHERE id = '585de1de-d967-459c-abb6-d9c69132597f'; -- RENATO AUGUSTO CONSOLARO DE OLIVEIRA
UPDATE public.alunos SET codigo_sgde = '1391586' WHERE id = 'f31e33da-38c5-43be-a02d-0198c4569e68'; -- ISADORA JULIA BRITO DE SOUZA
UPDATE public.alunos SET codigo_sgde = '1398761' WHERE id = '81056aaa-6be0-414a-a437-2ac387c6feaf'; -- EMANUELLY LIMA DA SILVA DE SOUZA
UPDATE public.alunos SET codigo_sgde = '1400553' WHERE id = '82351d37-1294-4deb-9cd8-4c32c238778a'; -- GUILHERME DENIZ DE FREITAS
UPDATE public.alunos SET codigo_sgde = '1408429' WHERE id = '0cab919b-56b1-4c05-ab40-286ada21b090'; -- BRUNO GABRIEL NASCIMENTO DE ALMEIDA
UPDATE public.alunos SET codigo_sgde = '1411006' WHERE id = '06e0295c-a474-4d4e-97f3-be90ec259148'; -- JOÃO GABRIEL FERNANDES DUDU FERREIRA
UPDATE public.alunos SET codigo_sgde = '1413114' WHERE id = '1cad1632-f88e-4a25-8022-f357c0235367'; -- BRENDA DE OLIVEIRA ROCHA
UPDATE public.alunos SET codigo_sgde = '1428053' WHERE id = '7465f9af-02c5-4b76-88a3-d2f42e7a5ec0'; -- OLAVO SOUZA MEDINA
UPDATE public.alunos SET codigo_sgde = '1429602' WHERE id = 'ad051d8d-867a-452f-8673-da27265f2bfe'; -- NATHALY GABRIELY GALVÃO DUARTE
UPDATE public.alunos SET codigo_sgde = '1437246' WHERE id = '9ee7f9fd-2abf-446a-afbf-65a3b2bc0477'; -- RYAN LEONARDO SILVA DE OLIVEIRA
UPDATE public.alunos SET codigo_sgde = '1437681' WHERE id = '1ccbc469-10a1-4e1c-b5da-2962d6927c19'; -- NICOLI KIMBERLY RODRIGUES MARTINS
UPDATE public.alunos SET codigo_sgde = '1445328' WHERE id = '9195882e-9a00-4e5f-bc1d-496d93ffc293'; -- CLARA VITÓRIA VIEIRA GIMENEZ DE CARVALHO
UPDATE public.alunos SET codigo_sgde = '1446010' WHERE id = 'c7b19845-538a-4312-a300-4be6aa1033be'; -- ESTEFANY VIEIRA RODRIGUES
UPDATE public.alunos SET codigo_sgde = '1449199' WHERE id = 'd9831293-de46-4e3d-8c60-6f617c7ae649'; -- JAQUELYNE LINCHE DE OLIVEIRA
UPDATE public.alunos SET codigo_sgde = '1449480' WHERE id = '98ef4f75-5e5e-433d-8445-5e3d1e155c96'; -- HENRIQUE  ECHEVERRIA DE MATOS
UPDATE public.alunos SET codigo_sgde = '1449811' WHERE id = '059eac77-32db-4f61-bfa5-ecb5b2fbd0c9'; -- IANNA CLEIDE BARBOSA DA SILVA
UPDATE public.alunos SET codigo_sgde = '1451715' WHERE id = 'deb1b1ad-c730-409d-ac65-f9d243708ac6'; -- BRENO GUSTAVO VALEJO DA SILVA
UPDATE public.alunos SET codigo_sgde = '1452108' WHERE id = 'a781e38b-cc7a-451b-8c88-48862a925320'; -- DANILO NUNES DOS SANTOS
UPDATE public.alunos SET codigo_sgde = '1455358' WHERE id = '0abdf83a-6733-4324-9d09-7a2aaccef39a'; -- IRIS DALIANA NOGUEIRA DOS SANTOS
UPDATE public.alunos SET codigo_sgde = '1455522' WHERE id = '737122c7-1990-4ef0-b217-fd16c6ef4e68'; -- ANA CARLA BATISTA NASCIMENTO
UPDATE public.alunos SET codigo_sgde = '1456536' WHERE id = 'acd44e02-9b09-47a9-b024-344120b0beff'; -- YAHN KALLEB BARBOSA DE OLIVEIRA
UPDATE public.alunos SET codigo_sgde = '1459563' WHERE id = '0a0d240a-355c-4fe7-b2e3-fc5875fdca94'; -- NATAN LUCAS DA SILVA GENEROSO
UPDATE public.alunos SET codigo_sgde = '1460854' WHERE id = '2f479613-c061-445b-a502-d337bc75ddf8'; -- MIGUEL PALAZZINI DE BRITO CARDOSO SANTOS
UPDATE public.alunos SET codigo_sgde = '1461822' WHERE id = '90caea93-3156-45c7-903f-0a8e8e60be7f'; -- JOSÉ MARIA DOS SANTOS NETO
UPDATE public.alunos SET codigo_sgde = '1469365' WHERE id = 'c9490be5-f496-4d4b-b5da-f6911f5f14f7'; -- LAYS BÁRBARA RODRIGUES ARRUDA
UPDATE public.alunos SET codigo_sgde = '1470383' WHERE id = 'f6b6113c-1709-483a-b756-daf64cf6b7f5'; -- ARON TALGATTI DOS SANTOS
UPDATE public.alunos SET codigo_sgde = '1471649' WHERE id = '523e8797-6d7d-4194-8333-74d58f8da93e'; -- PEDRO LIMA FLORES
UPDATE public.alunos SET codigo_sgde = '1471825' WHERE id = '07dfc40e-f05a-4935-a061-6ec1b5b615f0'; -- VICTOR HUGO BENITES PEREIRA SILVA
UPDATE public.alunos SET codigo_sgde = '1471844' WHERE id = 'f2ba8f7a-1cb6-415f-9705-12f91524b0cb'; -- GIOVANI COURA DE CASTRO
UPDATE public.alunos SET codigo_sgde = '1479384' WHERE id = 'd8296eec-9087-4059-a95a-89e550449712'; -- SOFIA MARQUES FERRAZ
UPDATE public.alunos SET codigo_sgde = '1099030' WHERE id = '72ceedc5-4f72-4d0d-8cf8-5fabe60aadd6'; -- HENZO ALMEIDA DA SILVA
UPDATE public.alunos SET codigo_sgde = '1155045' WHERE id = 'cdea6b6d-a14e-491e-9cd2-7ecab54affa7'; -- ALICE DE OLIVEIRA BARRETO
UPDATE public.alunos SET codigo_sgde = '1325591' WHERE id = '551abda7-64c6-4b14-a407-37298e8a725a'; -- NATHALLY AREVALOS DIAS
UPDATE public.alunos SET codigo_sgde = '1329676' WHERE id = 'ba8e7e06-bd77-4054-ab3d-c6d56773b697'; -- BRUNO HENRIQUE DE SOUZA
UPDATE public.alunos SET codigo_sgde = '1352360' WHERE id = '8e989c4c-032d-41c4-8d0d-201d836b91c5'; -- BEATRIZ CHAVES TAVARES
UPDATE public.alunos SET codigo_sgde = '1354858' WHERE id = '2e657bcc-348c-4949-9f15-6f21893d86f9'; -- MARIA EDUARDA MOURA SANTOS
UPDATE public.alunos SET codigo_sgde = '1359798' WHERE id = 'a116d6f2-233b-4d9c-bfc5-542dc543f196'; -- LAIZ GABRIELLY DOS SANTOS BATISTA
UPDATE public.alunos SET codigo_sgde = '1360746' WHERE id = 'c61bd92a-2c86-4515-a0e9-d3dc1004fa4c'; -- SUZANY DAIREN BENITES SANTOS
UPDATE public.alunos SET codigo_sgde = '1364162' WHERE id = '689fa77d-5fc4-4a45-aee6-1a4331bffbea'; -- EMILLY ESTER SANTANA MEDINA
UPDATE public.alunos SET codigo_sgde = '1365355' WHERE id = 'f4d5f53d-6b9c-4b12-896e-d3749e726d3a'; -- BEATRIZ FERNANDA OLIVEIRA
UPDATE public.alunos SET codigo_sgde = '1365890' WHERE id = 'b32cef4c-34da-43d2-879d-1cdfda985ab8'; -- ANA CLARA ALMEIDA DOS SANTOS
UPDATE public.alunos SET codigo_sgde = '1370071' WHERE id = 'a0c9ec79-8e97-430e-959c-af2ace6356da'; -- EMANUEL LIMA DA SILVA MARECO
UPDATE public.alunos SET codigo_sgde = '1378348' WHERE id = '85d3368c-7c14-46c9-94a7-bbd7f1c69d3f'; -- POLIANA CARDOSO LEITE
UPDATE public.alunos SET codigo_sgde = '1381845' WHERE id = '63f3fa1b-a621-4d65-8e03-df7c732ae18a'; -- WESLLEY RAFAEL FERREIRA
UPDATE public.alunos SET codigo_sgde = '1386835' WHERE id = '99014ed6-f807-49a9-9add-f22a1356793e'; -- LUIZ MIGUEL FLORENTIN GARCETE
UPDATE public.alunos SET codigo_sgde = '1391231' WHERE id = '40ea2629-9e50-47d1-af99-00dca781a342'; -- EMANUELLY CLAVICO NEVES
UPDATE public.alunos SET codigo_sgde = '1391587' WHERE id = 'f66caee0-89d3-4687-8ac6-52d1b3defbef'; -- ISABELLA BRITO DIAS
UPDATE public.alunos SET codigo_sgde = '1391660' WHERE id = '02ac6a7f-ec7f-4ef2-8973-1e46816809a1'; -- NICOLE GUTIERREZ NICOLAU
UPDATE public.alunos SET codigo_sgde = '1418072' WHERE id = '2031b602-1b44-4a4c-9881-b2bbcb17ca05'; -- ANA GABRIELLA DO ROSARIO BORGES
UPDATE public.alunos SET codigo_sgde = '1420488' WHERE id = 'bf131d6b-eda0-471b-b1aa-c542ef9c36ee'; -- HELLOISE KARINY ALMEIDA PARREIRA DA SILVA
UPDATE public.alunos SET codigo_sgde = '1442595' WHERE id = '64ac9cb7-52c7-433c-8aa4-51f8bb6b61ac'; -- GABRIELLY MESQUITA
UPDATE public.alunos SET codigo_sgde = '1442911' WHERE id = '783156c1-b8b2-48b9-90d4-11873f077310'; -- SHAHARAZADE CRISTINA APARECIDA NOGUEIRA MOTTA PINTO
UPDATE public.alunos SET codigo_sgde = '1448015' WHERE id = '37b43886-b50b-49ac-b646-99109214da4c'; -- LAUREN CABRIOTI ANDRADE BARROS
UPDATE public.alunos SET codigo_sgde = '1448242' WHERE id = '5424f911-4e93-4264-ad57-3ea28cadd3fd'; -- DAVI FERNANDES DE ALMEIDA PRADO
UPDATE public.alunos SET codigo_sgde = '1449183' WHERE id = '8037fdbf-a2e4-4f7d-b738-99af988f9d95'; -- GERSON PEREIRA SILVA NETO
UPDATE public.alunos SET codigo_sgde = '1449316' WHERE id = '03dca3cb-0fa3-41a4-b60b-96e92dbe121a'; -- PEDRO GUILHERME FRANÇA VIEIRA
UPDATE public.alunos SET codigo_sgde = '1450418' WHERE id = '71281bc3-b587-4f3d-ae61-3c1d38fdcec7'; -- EMILY NOGUEIRA ELICHESE
UPDATE public.alunos SET codigo_sgde = '1450707' WHERE id = '6bdfd164-e88e-416b-a42d-05c6ca319a1f'; -- SARAH SOUZA DE OLIVEIRA
UPDATE public.alunos SET codigo_sgde = '1452341' WHERE id = 'c131130c-83db-4bd3-acf6-a341c06495ac'; -- DAVI GONÇALVES IRALA
UPDATE public.alunos SET codigo_sgde = '1454722' WHERE id = '529788f3-81c6-47b0-bcff-e4d422866366'; -- MIGUEL SILVA SANTELA
UPDATE public.alunos SET codigo_sgde = '1458304' WHERE id = '2874ea11-9779-4dc2-bf85-d4d5df1ea8ae'; -- THIAGO ANTUNES DA SILVA
UPDATE public.alunos SET codigo_sgde = '1459516' WHERE id = '69cb6cbd-1db9-4c3a-a524-125af9f3edbe'; -- DAFNI VITÓRIA CAETANO FINAMOR
UPDATE public.alunos SET codigo_sgde = '1459685' WHERE id = 'c29c15b4-22ba-4b74-a403-661f022c069e'; -- EMILLY GABRIELE DA SILVA MIRANDA
UPDATE public.alunos SET codigo_sgde = '1460195' WHERE id = 'c9f23545-19bb-4c92-b8d5-d64a6247e2fc'; -- MARIA EDUARDA NÓBREGA COLOMBO
UPDATE public.alunos SET codigo_sgde = '1463012' WHERE id = 'c3ff0435-337b-4891-91a7-ea500b209ae5'; -- AGHATA MERIÊ PEIXOTO VILLALBA
UPDATE public.alunos SET codigo_sgde = '1467661' WHERE id = '0ecccd9a-d8a7-47c3-abb2-635b4a3bf082'; -- ALICE DE LARA WIDER
UPDATE public.alunos SET codigo_sgde = '1469392' WHERE id = 'f4fb6055-cb8c-4208-aeff-32acce2c6c98'; -- BRUNO VINÍCIUS SERRA NOSTÓRIO
UPDATE public.alunos SET codigo_sgde = '1476408' WHERE id = '00ff44b7-6f2d-4d77-a3b9-3a722fcf81a9'; -- SUELLEN SANTOS NASCIMENTO BARBOSA
UPDATE public.alunos SET codigo_sgde = '1480826' WHERE id = 'a85dd5af-7faf-42ba-9e35-47f480a87f52'; -- GUILHERME SILVA CIMATTI
UPDATE public.alunos SET codigo_sgde = '1481181' WHERE id = '833a9388-adcb-4e96-b2b2-792dabfa2d25'; -- LEONARDO MOREIRA RODRIGUES
UPDATE public.alunos SET codigo_sgde = '1484168' WHERE id = '741c3e6f-e1d0-4077-a0e1-f0787c8e8994'; -- YSADORA RODRIGUES DE LIMA
UPDATE public.alunos SET codigo_sgde = '1484992' WHERE id = '2bb91e9e-277c-4dd6-af21-465af4b8e7cc'; -- JOSÉ VICTOR DE ARAUJO RAMOS
UPDATE public.alunos SET codigo_sgde = '1090723' WHERE id = '1a1864fd-1e24-4b5f-980f-c6d8db0013bc'; -- RAFAEL AUGUSTO LOPES MORETTO
UPDATE public.alunos SET codigo_sgde = '1101460' WHERE id = '8df41d97-931d-498a-a08f-6d974c1777e0'; -- BETINA BATISTA DE SOUZA
UPDATE public.alunos SET codigo_sgde = '1118418' WHERE id = 'c05ea818-9ca1-4faf-aa79-3e2fb85a794c'; -- ANA JULLYA AZEVEDO PRADO
UPDATE public.alunos SET codigo_sgde = '1132068' WHERE id = '4c235701-1ed2-4383-bcb5-4dc639d12397'; -- CLARA HORING DUARTE
UPDATE public.alunos SET codigo_sgde = '1145751' WHERE id = '2c0dec83-a4c2-455f-b360-aaf2dda832e9'; -- DANIEL SILVA DE OLIVEIRA
UPDATE public.alunos SET codigo_sgde = '1159880' WHERE id = 'c720e90d-0951-4ece-9d6e-9692a9c756c8'; -- LUCAS LIMA DE ANDRADE
UPDATE public.alunos SET codigo_sgde = '1160244' WHERE id = '98c153a7-4dbd-405e-8c49-7c9c547446e5'; -- SOFIA ORTIZ ARAUJO
UPDATE public.alunos SET codigo_sgde = '1290003' WHERE id = '59680293-cf1f-4760-9f8c-70dad0877efc'; -- NINIVY MARTINS DE CAMPOS
UPDATE public.alunos SET codigo_sgde = '1317186' WHERE id = '3e54bafc-eb12-404b-be24-621f20544340'; -- RAPHAELA DANTAS DE ARAUJO
UPDATE public.alunos SET codigo_sgde = '1328785' WHERE id = '51723b1e-0c2c-4476-bc6d-12403734d957'; -- STHER VITÓRIA CABRAL AQUINO
UPDATE public.alunos SET codigo_sgde = '1333875' WHERE id = '3f2f82ea-5235-4566-8329-cf151345c3cf'; -- GUSTAVO SOUZA DO PRADO
UPDATE public.alunos SET codigo_sgde = '1344027' WHERE id = '6de3816e-23c6-4bae-b64b-cbe1f24cd498'; -- OTÁVIO AUGUSTO DOS SANTOS MACHADO
UPDATE public.alunos SET codigo_sgde = '1356905' WHERE id = 'e89c2158-3ec6-42eb-b05b-43ad88e52d0a'; -- ARTHUR ESCRIVANO GONÇALVES
UPDATE public.alunos SET codigo_sgde = '1364194' WHERE id = 'e3a0da5e-06f6-44f7-b02b-0b3e6b102147'; -- HEITOR NUNES DE OLIVEIRA
UPDATE public.alunos SET codigo_sgde = '1395564' WHERE id = '14eeac64-89a4-4a7c-b5fe-a2784cddebe5'; -- MARIAH CRISTINA DOS SANTOS LOPES
UPDATE public.alunos SET codigo_sgde = '1396034' WHERE id = '989c0cee-6f47-43ef-8271-c636f183e550'; -- CARLOS HENRIQUE AUBRY PELEGRINI DOS SANTOS
UPDATE public.alunos SET codigo_sgde = '1396763' WHERE id = '496bc640-c542-4275-a599-ba57976fbf8b'; -- MARIA EDUARDA OLIVEIRA CORREA
UPDATE public.alunos SET codigo_sgde = '1401563' WHERE id = '7a7922a0-95c1-4b53-b324-1829cfc9252b'; -- ASAFE SERAFIM SALES
UPDATE public.alunos SET codigo_sgde = '1408050' WHERE id = 'b06ab06c-7f27-4d11-9b15-c1e6e4a20c1f'; -- JOÃO GABRIEL DOS REIS PALMITESTA
UPDATE public.alunos SET codigo_sgde = '1410352' WHERE id = 'c894d1b9-8c80-4f36-9fef-c2f09cc445a7'; -- KAUÃ HENRRIQUE DIAS BARBOSA
UPDATE public.alunos SET codigo_sgde = '1411439' WHERE id = '774dd617-fcad-43dc-960b-a8305651ea2f'; -- IZABELY VITÓRIA FERREIRA PORTILHO
UPDATE public.alunos SET codigo_sgde = '1414760' WHERE id = '812856a1-a6a5-46fe-99ca-fd8f13d1dccd'; -- LAURA COSTA BARBOSA
UPDATE public.alunos SET codigo_sgde = '1415250' WHERE id = 'b845cbc8-1b4f-4047-b1f3-989e4f77f3d5'; -- COLLYNS GABRIEL SOARES PUERARI
UPDATE public.alunos SET codigo_sgde = '1416617' WHERE id = 'd05b8a64-48f3-435f-9210-01afa8afa9a3'; -- KARINE BEATRIZ CARVALHO ALVES
UPDATE public.alunos SET codigo_sgde = '1417144' WHERE id = '1486ed5a-ca00-4e61-87ec-26bbb6a200b2'; -- GUSTAVO BRITO PEREIRA
UPDATE public.alunos SET codigo_sgde = '1417637' WHERE id = '0f0fddc8-42bc-4351-ab51-d065a0185932'; -- ANA ORTIZ DE SOUZA FERREIRA
UPDATE public.alunos SET codigo_sgde = '1417799' WHERE id = 'ceaa82e0-f486-41b0-b6ca-e6c7c525b871'; -- KAYO BRITO ORTIZ
UPDATE public.alunos SET codigo_sgde = '1434210' WHERE id = '5f1eb6f8-48e5-4000-9f8b-9e83c272e1b5'; -- AGHATA MELLYSSA DUARTE PAIVA
UPDATE public.alunos SET codigo_sgde = '1438349' WHERE id = '7e3cee15-ae8c-4e6a-aaf4-12d330ef2941'; -- GEOVANNA BARBOSA DO COUTO
UPDATE public.alunos SET codigo_sgde = '1441751' WHERE id = '7de0e18f-53b8-44c1-a0ca-eb65a2d588cd'; -- ELIAS MIGUEL NUNES CORREA
UPDATE public.alunos SET codigo_sgde = '1445741' WHERE id = 'e1081ced-3f74-496f-9c6d-1f4c710f043f'; -- HELLEN ALVES DE SOUZA
UPDATE public.alunos SET codigo_sgde = '1449499' WHERE id = 'f04940f0-f859-4318-bf19-2b7d083b6040'; -- HELOÍSA SILVA DE SOUZA
UPDATE public.alunos SET codigo_sgde = '1449671' WHERE id = '9aad612e-a42d-4f33-ad48-a8a1c52b198c'; -- IZABELLA FLOR LINS
UPDATE public.alunos SET codigo_sgde = '1450240' WHERE id = 'eaee0ea3-80fd-468b-8e63-1fbfc13f9e28'; -- ÁGATA RODRIGUES DA SILVA
UPDATE public.alunos SET codigo_sgde = '1451589' WHERE id = '5d5b93f7-a428-4446-b16c-526c107ac8a6'; -- HELOISA DA COSTA ORTIZ
UPDATE public.alunos SET codigo_sgde = '1452753' WHERE id = 'b99d1441-74bb-4dc9-aaa7-9cd9e6a57476'; -- JOÃO EDUARDO PEREIRA ALEM
UPDATE public.alunos SET codigo_sgde = '1457716' WHERE id = 'ea946604-66cb-4c28-ab53-6ace4b1d1c59'; -- KETHELLYN RODRIGUES DA SILVA
UPDATE public.alunos SET codigo_sgde = '1460503' WHERE id = '494759ee-84b0-49a8-9dc0-ad72c9c26de8'; -- KELVYN HENRIQUE ARAUJO DOS SANTOS
UPDATE public.alunos SET codigo_sgde = '1465878' WHERE id = '8318f2ac-83eb-4e59-8e43-81a43da19aba'; -- CARLOS HENRIQUE DE OLIVEIRA PORTELA
UPDATE public.alunos SET codigo_sgde = '1467010' WHERE id = '35baa72c-705a-4702-b318-fa9667d95c38'; -- LUKAS OLIVEIRA TORRES
UPDATE public.alunos SET codigo_sgde = '1469358' WHERE id = '845e4ca4-5998-4fbc-ac24-2b271c0d2a55'; -- LUIZ MIGUEL RODRIGUES ARRUDA
UPDATE public.alunos SET codigo_sgde = '1470015' WHERE id = '5a131894-2fb5-478b-bf15-8b51bced767c'; -- KAÍKE SILVA DOS SANTOS
UPDATE public.alunos SET codigo_sgde = '1470996' WHERE id = '94c0b9d8-44d5-4952-a8ae-ebd7c957802e'; -- NICOLAS DOS SANTOS BRUM
UPDATE public.alunos SET codigo_sgde = '1477175' WHERE id = '7fcf758f-52d6-4595-8b9a-ff09ac536b7f'; -- MIGUEL OLIVEIRA DOS SANTOS
UPDATE public.alunos SET codigo_sgde = '1481506' WHERE id = '3783e0ae-737d-4166-9d21-f073ccd8fb0c'; -- JÚLIA MONTEIRO BENASSI
UPDATE public.alunos SET codigo_sgde = '1481516' WHERE id = 'd643f4d2-cb4a-489f-8085-ba0ab9a128ba'; -- KAUÃ PORTILHO BRAGA
UPDATE public.alunos SET codigo_sgde = '1484413' WHERE id = 'fe39e4bf-0c21-4c69-9818-f9b44152e339'; -- BRUNO VAZ DE LIMA GOMES

-- Alunos das planilhas SEM correspondente no cadastro atual (nao receberam codigo_sgde nem notas):
-- 2º Ano A | cod 924824 | CRISTIAN EDUARDO RAMIRES DA SILVA
-- 7º Ano A | cod 1486206 | ISAQUE SIMÕES PEREIRA
-- 7º Ano A | cod 1486414 | GIOVANNI SANCHES DOS SANTOS
-- 8º Ano A | cod 1359505 | AMANDA JARA GABRIEL DA SILVA
-- 8º Ano A | cod 1366787 | THEYLOR CEZAR DA SILVA QUEBRA
-- 8º Ano A | cod 1383907 | GABRIELLY DE ARAUJO BIALTA SILVA
-- 8º Ano A | cod 1407101 | LOANY ALVES BRAGA
-- 8º Ano A | cod 1470837 | VITOR DE CASTRO SILVA
-- 8º Ano A | cod 1475457 | SAMIRA SOARES FERNANDES
-- 8º Ano A | cod 1484627 | MIGUEL  ARTHUR MELLO AMARAL
-- 9º Ano A | cod 1331459 | ISADORA LOPES SOUSA DA SILVA
-- 9º Ano A | cod 1359524 | LARISSA JARA GABRIEL DA SILVA
-- 9º Ano A | cod 1485104 | DAVI ANTONIO DE OLIVEIRA FARIAS
-- 9º Ano A | cod 1485311 | DAVI GUENKA AZUAGA
-- 9º Ano A | cod 1487787 | CAUÃ HENRIQUE AREDES MOREIRA
