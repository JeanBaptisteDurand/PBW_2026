--
-- PostgreSQL database dump
--

\restrict zgtNwDW6s45HJDS8xSE5TnRetQrv1eiOmVrnvCogDgaUuoAETfIBmelgEejGjVC

-- Dumped from database version 16.13 (Debian 16.13-1.pgdg12+1)
-- Dumped by pg_dump version 16.13 (Debian 16.13-1.pgdg12+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: vector; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;


--
-- Name: EXTENSION vector; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION vector IS 'vector data type and ivfflat and hnsw access methods';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Analysis; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Analysis" (
    id text NOT NULL,
    status text DEFAULT 'queued'::text NOT NULL,
    "seedAddress" text NOT NULL,
    "seedLabel" text,
    error text,
    "summaryJson" jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    depth integer DEFAULT 1 NOT NULL,
    "userId" text
);


--
-- Name: ComplianceReport; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ComplianceReport" (
    id text NOT NULL,
    "analysisId" text NOT NULL,
    title text NOT NULL,
    content jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Corridor; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Corridor" (
    id text NOT NULL,
    label text NOT NULL,
    "shortLabel" text NOT NULL,
    flag text NOT NULL,
    tier integer NOT NULL,
    importance integer NOT NULL,
    region text NOT NULL,
    category text NOT NULL,
    description text NOT NULL,
    "useCase" text NOT NULL,
    highlights jsonb NOT NULL,
    "relatedIds" jsonb,
    "requestJson" jsonb,
    status text DEFAULT 'UNKNOWN'::text NOT NULL,
    "pathCount" integer DEFAULT 0 NOT NULL,
    "recRiskScore" integer,
    "recHops" integer,
    "recCost" text,
    "flagsJson" jsonb,
    "analysisJson" jsonb,
    "liquidityJson" jsonb,
    "aiNote" text,
    "liquidityHash" text,
    "aiNoteHash" text,
    "lastRefreshedAt" timestamp(3) without time zone,
    "lastError" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    amount text,
    "bestRouteId" text,
    "destJson" jsonb,
    "routesJson" jsonb,
    "sourceJson" jsonb
);


--
-- Name: CorridorRagChat; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CorridorRagChat" (
    id text NOT NULL,
    "corridorId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: CorridorRagDocument; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CorridorRagDocument" (
    id text NOT NULL,
    "corridorId" text NOT NULL,
    content text NOT NULL,
    metadata jsonb,
    embedding public.vector(1536),
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: CorridorRagMessage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CorridorRagMessage" (
    id text NOT NULL,
    "chatId" text NOT NULL,
    role text NOT NULL,
    content text NOT NULL,
    sources jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: CorridorStatusEvent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CorridorStatusEvent" (
    id text NOT NULL,
    "corridorId" text NOT NULL,
    status text NOT NULL,
    "pathCount" integer DEFAULT 0 NOT NULL,
    "recCost" text,
    source text DEFAULT 'scan'::text NOT NULL,
    at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Edge; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Edge" (
    id text NOT NULL,
    "analysisId" text NOT NULL,
    "edgeId" text NOT NULL,
    source text NOT NULL,
    target text NOT NULL,
    kind text NOT NULL,
    label text,
    data jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Node; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Node" (
    id text NOT NULL,
    "analysisId" text NOT NULL,
    "nodeId" text NOT NULL,
    kind text NOT NULL,
    label text NOT NULL,
    data jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "aiExplanation" text
);


--
-- Name: PaymentRequest; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PaymentRequest" (
    id text NOT NULL,
    "userId" text NOT NULL,
    amount text NOT NULL,
    currency text NOT NULL,
    destination text NOT NULL,
    memo text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    "txHash" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: PremiumSubscription; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PremiumSubscription" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "txHash" text NOT NULL,
    amount text NOT NULL,
    currency text NOT NULL,
    "walletAddress" text NOT NULL,
    memo text NOT NULL,
    "paidAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: RagChat; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RagChat" (
    id text NOT NULL,
    "analysisId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: RagDocument; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RagDocument" (
    id text NOT NULL,
    "analysisId" text NOT NULL,
    content text NOT NULL,
    metadata jsonb,
    embedding public.vector(1536),
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: RagMessage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RagMessage" (
    id text NOT NULL,
    "chatId" text NOT NULL,
    role text NOT NULL,
    content text NOT NULL,
    sources jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: RiskFlag; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RiskFlag" (
    id text NOT NULL,
    "analysisId" text NOT NULL,
    "nodeId" text NOT NULL,
    flag text NOT NULL,
    severity text NOT NULL,
    detail text NOT NULL,
    data jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: SafePathRun; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SafePathRun" (
    id text NOT NULL,
    "userId" text,
    "srcCcy" text NOT NULL,
    "dstCcy" text NOT NULL,
    amount text NOT NULL,
    "maxRiskTolerance" text DEFAULT 'MED'::text NOT NULL,
    verdict text NOT NULL,
    reasoning text NOT NULL,
    "resultJson" jsonb NOT NULL,
    "reportMarkdown" text,
    "corridorId" text,
    "analysisIds" jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: User; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."User" (
    id text NOT NULL,
    "walletAddress" text NOT NULL,
    role text DEFAULT 'free'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "apiKey" text
);


--
-- Name: Analysis Analysis_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Analysis"
    ADD CONSTRAINT "Analysis_pkey" PRIMARY KEY (id);


--
-- Name: ComplianceReport ComplianceReport_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ComplianceReport"
    ADD CONSTRAINT "ComplianceReport_pkey" PRIMARY KEY (id);


--
-- Name: CorridorRagChat CorridorRagChat_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CorridorRagChat"
    ADD CONSTRAINT "CorridorRagChat_pkey" PRIMARY KEY (id);


--
-- Name: CorridorRagDocument CorridorRagDocument_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CorridorRagDocument"
    ADD CONSTRAINT "CorridorRagDocument_pkey" PRIMARY KEY (id);


--
-- Name: CorridorRagMessage CorridorRagMessage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CorridorRagMessage"
    ADD CONSTRAINT "CorridorRagMessage_pkey" PRIMARY KEY (id);


--
-- Name: CorridorStatusEvent CorridorStatusEvent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CorridorStatusEvent"
    ADD CONSTRAINT "CorridorStatusEvent_pkey" PRIMARY KEY (id);


--
-- Name: Corridor Corridor_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Corridor"
    ADD CONSTRAINT "Corridor_pkey" PRIMARY KEY (id);


--
-- Name: Edge Edge_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Edge"
    ADD CONSTRAINT "Edge_pkey" PRIMARY KEY (id);


--
-- Name: Node Node_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Node"
    ADD CONSTRAINT "Node_pkey" PRIMARY KEY (id);


--
-- Name: PaymentRequest PaymentRequest_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PaymentRequest"
    ADD CONSTRAINT "PaymentRequest_pkey" PRIMARY KEY (id);


--
-- Name: PremiumSubscription PremiumSubscription_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PremiumSubscription"
    ADD CONSTRAINT "PremiumSubscription_pkey" PRIMARY KEY (id);


--
-- Name: RagChat RagChat_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RagChat"
    ADD CONSTRAINT "RagChat_pkey" PRIMARY KEY (id);


--
-- Name: RagDocument RagDocument_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RagDocument"
    ADD CONSTRAINT "RagDocument_pkey" PRIMARY KEY (id);


--
-- Name: RagMessage RagMessage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RagMessage"
    ADD CONSTRAINT "RagMessage_pkey" PRIMARY KEY (id);


--
-- Name: RiskFlag RiskFlag_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RiskFlag"
    ADD CONSTRAINT "RiskFlag_pkey" PRIMARY KEY (id);


--
-- Name: SafePathRun SafePathRun_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SafePathRun"
    ADD CONSTRAINT "SafePathRun_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: Analysis_seedAddress_depth_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Analysis_seedAddress_depth_status_idx" ON public."Analysis" USING btree ("seedAddress", depth, status);


--
-- Name: Analysis_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Analysis_userId_idx" ON public."Analysis" USING btree ("userId");


--
-- Name: CorridorRagDocument_corridorId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CorridorRagDocument_corridorId_idx" ON public."CorridorRagDocument" USING btree ("corridorId");


--
-- Name: CorridorRagMessage_chatId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CorridorRagMessage_chatId_idx" ON public."CorridorRagMessage" USING btree ("chatId");


--
-- Name: CorridorStatusEvent_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CorridorStatusEvent_at_idx" ON public."CorridorStatusEvent" USING btree (at);


--
-- Name: CorridorStatusEvent_corridorId_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CorridorStatusEvent_corridorId_at_idx" ON public."CorridorStatusEvent" USING btree ("corridorId", at);


--
-- Name: Corridor_importance_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Corridor_importance_idx" ON public."Corridor" USING btree (importance);


--
-- Name: Corridor_tier_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Corridor_tier_idx" ON public."Corridor" USING btree (tier);


--
-- Name: Edge_analysisId_edgeId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Edge_analysisId_edgeId_key" ON public."Edge" USING btree ("analysisId", "edgeId");


--
-- Name: Edge_analysisId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Edge_analysisId_idx" ON public."Edge" USING btree ("analysisId");


--
-- Name: Node_analysisId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Node_analysisId_idx" ON public."Node" USING btree ("analysisId");


--
-- Name: Node_analysisId_nodeId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Node_analysisId_nodeId_key" ON public."Node" USING btree ("analysisId", "nodeId");


--
-- Name: PaymentRequest_memo_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PaymentRequest_memo_idx" ON public."PaymentRequest" USING btree (memo);


--
-- Name: PaymentRequest_memo_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PaymentRequest_memo_key" ON public."PaymentRequest" USING btree (memo);


--
-- Name: PaymentRequest_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PaymentRequest_status_idx" ON public."PaymentRequest" USING btree (status);


--
-- Name: PremiumSubscription_memo_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PremiumSubscription_memo_key" ON public."PremiumSubscription" USING btree (memo);


--
-- Name: PremiumSubscription_txHash_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PremiumSubscription_txHash_key" ON public."PremiumSubscription" USING btree ("txHash");


--
-- Name: PremiumSubscription_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PremiumSubscription_userId_idx" ON public."PremiumSubscription" USING btree ("userId");


--
-- Name: PremiumSubscription_walletAddress_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PremiumSubscription_walletAddress_idx" ON public."PremiumSubscription" USING btree ("walletAddress");


--
-- Name: RagDocument_analysisId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RagDocument_analysisId_idx" ON public."RagDocument" USING btree ("analysisId");


--
-- Name: RiskFlag_analysisId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RiskFlag_analysisId_idx" ON public."RiskFlag" USING btree ("analysisId");


--
-- Name: SafePathRun_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SafePathRun_createdAt_idx" ON public."SafePathRun" USING btree ("createdAt");


--
-- Name: SafePathRun_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SafePathRun_userId_idx" ON public."SafePathRun" USING btree ("userId");


--
-- Name: User_apiKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_apiKey_key" ON public."User" USING btree ("apiKey");


--
-- Name: User_walletAddress_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_walletAddress_key" ON public."User" USING btree ("walletAddress");


--
-- Name: Analysis Analysis_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Analysis"
    ADD CONSTRAINT "Analysis_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ComplianceReport ComplianceReport_analysisId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ComplianceReport"
    ADD CONSTRAINT "ComplianceReport_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES public."Analysis"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CorridorRagChat CorridorRagChat_corridorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CorridorRagChat"
    ADD CONSTRAINT "CorridorRagChat_corridorId_fkey" FOREIGN KEY ("corridorId") REFERENCES public."Corridor"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: CorridorRagDocument CorridorRagDocument_corridorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CorridorRagDocument"
    ADD CONSTRAINT "CorridorRagDocument_corridorId_fkey" FOREIGN KEY ("corridorId") REFERENCES public."Corridor"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CorridorRagMessage CorridorRagMessage_chatId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CorridorRagMessage"
    ADD CONSTRAINT "CorridorRagMessage_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES public."CorridorRagChat"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CorridorStatusEvent CorridorStatusEvent_corridorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CorridorStatusEvent"
    ADD CONSTRAINT "CorridorStatusEvent_corridorId_fkey" FOREIGN KEY ("corridorId") REFERENCES public."Corridor"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Edge Edge_analysisId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Edge"
    ADD CONSTRAINT "Edge_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES public."Analysis"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Node Node_analysisId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Node"
    ADD CONSTRAINT "Node_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES public."Analysis"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PremiumSubscription PremiumSubscription_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PremiumSubscription"
    ADD CONSTRAINT "PremiumSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: RagChat RagChat_analysisId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RagChat"
    ADD CONSTRAINT "RagChat_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES public."Analysis"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: RagDocument RagDocument_analysisId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RagDocument"
    ADD CONSTRAINT "RagDocument_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES public."Analysis"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: RagMessage RagMessage_chatId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RagMessage"
    ADD CONSTRAINT "RagMessage_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES public."RagChat"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: RiskFlag RiskFlag_analysisId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RiskFlag"
    ADD CONSTRAINT "RiskFlag_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES public."Analysis"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SafePathRun SafePathRun_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SafePathRun"
    ADD CONSTRAINT "SafePathRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict zgtNwDW6s45HJDS8xSE5TnRetQrv1eiOmVrnvCogDgaUuoAETfIBmelgEejGjVC

