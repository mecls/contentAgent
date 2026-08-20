// Generated from hub/convex-backend by scripts/sync-types.mjs. Do not edit.
// Declarations only — the implementation stays in the backend repo.
declare const _default: import("convex/server").SchemaDefinition<{
    account_members: import("convex/server").TableDefinition<import("convex/values").VObject<{
        account_id: string;
        user_id: string;
        role: string;
    }, {
        account_id: import("convex/values").VString<string, "required">;
        user_id: import("convex/values").VString<string, "required">;
        role: import("convex/values").VString<string, "required">;
    }, "required", "account_id" | "user_id" | "role">, {
        by_account_id_user_id: ["account_id", "user_id", "_creationTime"];
        by_user_id: ["user_id", "_creationTime"];
        by_account_id: ["account_id", "_creationTime"];
    }, {}, {}>;
    accounts: import("convex/server").TableDefinition<import("convex/values").VObject<{
        id: string;
        owner_email: string;
        created_at: number;
    }, {
        id: import("convex/values").VString<string, "required">;
        owner_email: import("convex/values").VString<string, "required">;
        created_at: import("convex/values").VFloat64<number, "required">;
    }, "required", "id" | "owner_email" | "created_at">, {
        by_pg_id: ["id", "_creationTime"];
    }, {}, {}>;
    app_settings: import("convex/server").TableDefinition<import("convex/values").VObject<{
        id: string;
        automate: boolean;
    }, {
        id: import("convex/values").VString<string, "required">;
        automate: import("convex/values").VBoolean<boolean, "required">;
    }, "required", "id" | "automate">, {
        by_pg_id: ["id", "_creationTime"];
    }, {}, {}>;
    audits: import("convex/server").TableDefinition<import("convex/values").VObject<{
        id: string;
        created_at: number;
        slug: string;
        status: "pending" | "ready" | "failed";
        email: string;
        lead_data: any;
        content: any;
        error_message: string | null;
        ready_at: number | null;
        lead_id: string | null;
    }, {
        id: import("convex/values").VString<string, "required">;
        slug: import("convex/values").VString<string, "required">;
        status: import("convex/values").VUnion<"pending" | "ready" | "failed", [import("convex/values").VLiteral<"pending", "required">, import("convex/values").VLiteral<"ready", "required">, import("convex/values").VLiteral<"failed", "required">], "required", never>;
        email: import("convex/values").VString<string, "required">;
        lead_data: import("convex/values").VAny<any, "required", string>;
        content: import("convex/values").VAny<any, "required", string>;
        error_message: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        created_at: import("convex/values").VFloat64<number, "required">;
        ready_at: import("convex/values").VUnion<number | null, [import("convex/values").VFloat64<number, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        lead_id: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
    }, "required", "id" | "created_at" | "slug" | "status" | "email" | "lead_data" | "content" | "error_message" | "ready_at" | "lead_id" | `lead_data.${string}` | `content.${string}`>, {
        by_pg_id: ["id", "_creationTime"];
        by_slug: ["slug", "_creationTime"];
        by_email: ["email", "_creationTime"];
        by_status_created_at: ["status", "created_at", "_creationTime"];
        by_lead_id: ["lead_id", "_creationTime"];
    }, {}, {}>;
    catalog_items: import("convex/server").TableDefinition<import("convex/values").VObject<{
        id: string;
        category: string;
        description: string;
        unit: "m2" | "ml" | "unidade" | "hora" | "global";
        unit_price: number;
        iva_rate: number;
        active: boolean;
        updated_at: number;
    }, {
        id: import("convex/values").VString<string, "required">;
        category: import("convex/values").VString<string, "required">;
        description: import("convex/values").VString<string, "required">;
        unit: import("convex/values").VUnion<"m2" | "ml" | "unidade" | "hora" | "global", [import("convex/values").VLiteral<"m2", "required">, import("convex/values").VLiteral<"ml", "required">, import("convex/values").VLiteral<"unidade", "required">, import("convex/values").VLiteral<"hora", "required">, import("convex/values").VLiteral<"global", "required">], "required", never>;
        unit_price: import("convex/values").VFloat64<number, "required">;
        iva_rate: import("convex/values").VFloat64<number, "required">;
        active: import("convex/values").VBoolean<boolean, "required">;
        updated_at: import("convex/values").VFloat64<number, "required">;
    }, "required", "id" | "category" | "description" | "unit" | "unit_price" | "iva_rate" | "active" | "updated_at">, {
        by_pg_id: ["id", "_creationTime"];
    }, {}, {}>;
    config: import("convex/server").TableDefinition<import("convex/values").VObject<{
        account_id: string;
        key: string;
        value: any;
    }, {
        account_id: import("convex/values").VString<string, "required">;
        key: import("convex/values").VString<string, "required">;
        value: import("convex/values").VAny<any, "required", string>;
    }, "required", "account_id" | "key" | "value" | `value.${string}`>, {
        by_account_id_key: ["account_id", "key", "_creationTime"];
        by_account_id: ["account_id", "_creationTime"];
    }, {}, {}>;
    content_competitor_posts: import("convex/server").TableDefinition<import("convex/values").VObject<{
        id: string;
        account_id: string;
        content: string | null;
        competitor_id: string | null;
        source_url: string;
        posted_at: number | null;
        metrics: any;
        features: any;
        scraped_at: number;
    }, {
        id: import("convex/values").VString<string, "required">;
        account_id: import("convex/values").VString<string, "required">;
        competitor_id: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        source_url: import("convex/values").VString<string, "required">;
        content: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        posted_at: import("convex/values").VUnion<number | null, [import("convex/values").VFloat64<number, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        metrics: import("convex/values").VAny<any, "required", string>;
        features: import("convex/values").VAny<any, "required", string>;
        scraped_at: import("convex/values").VFloat64<number, "required">;
    }, "required", "id" | "account_id" | "content" | "competitor_id" | "source_url" | "posted_at" | "metrics" | "features" | "scraped_at" | `metrics.${string}` | `features.${string}`>, {
        by_pg_id: ["id", "_creationTime"];
        by_account_id_source_url: ["account_id", "source_url", "_creationTime"];
        by_account_id_competitor_id: ["account_id", "competitor_id", "_creationTime"];
        by_account_id: ["account_id", "_creationTime"];
        by_competitor_id: ["competitor_id", "_creationTime"];
    }, {}, {}>;
    content_competitors: import("convex/server").TableDefinition<import("convex/values").VObject<{
        id: string;
        account_id: string;
        created_at: number;
        active: boolean;
        profile_url: string;
        name: string | null;
    }, {
        id: import("convex/values").VString<string, "required">;
        account_id: import("convex/values").VString<string, "required">;
        profile_url: import("convex/values").VString<string, "required">;
        name: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        active: import("convex/values").VBoolean<boolean, "required">;
        created_at: import("convex/values").VFloat64<number, "required">;
    }, "required", "id" | "account_id" | "created_at" | "active" | "profile_url" | "name">, {
        by_pg_id: ["id", "_creationTime"];
        by_account_id_profile_url: ["account_id", "profile_url", "_creationTime"];
        by_account_id: ["account_id", "_creationTime"];
    }, {}, {}>;
    content_content_plans: import("convex/server").TableDefinition<import("convex/values").VObject<{
        id: string;
        account_id: string;
        created_at: number;
        platform: string;
        horizon_days: number | null;
        summary: string | null;
        trends: any;
    }, {
        id: import("convex/values").VString<string, "required">;
        account_id: import("convex/values").VString<string, "required">;
        platform: import("convex/values").VString<string, "required">;
        horizon_days: import("convex/values").VUnion<number | null, [import("convex/values").VFloat64<number, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        summary: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        trends: import("convex/values").VAny<any, "required", string>;
        created_at: import("convex/values").VFloat64<number, "required">;
    }, "required", "id" | "account_id" | "created_at" | "platform" | "horizon_days" | "summary" | "trends" | `trends.${string}`>, {
        by_pg_id: ["id", "_creationTime"];
        by_account_id_created_at: ["account_id", "created_at", "_creationTime"];
        by_account_id: ["account_id", "_creationTime"];
    }, {}, {}>;
    content_conversations: import("convex/server").TableDefinition<import("convex/values").VObject<{
        id: string;
        account_id: string;
        created_at: number;
        updated_at: number;
        title: string;
    }, {
        id: import("convex/values").VString<string, "required">;
        account_id: import("convex/values").VString<string, "required">;
        title: import("convex/values").VString<string, "required">;
        created_at: import("convex/values").VFloat64<number, "required">;
        updated_at: import("convex/values").VFloat64<number, "required">;
    }, "required", "id" | "account_id" | "created_at" | "updated_at" | "title">, {
        by_pg_id: ["id", "_creationTime"];
        by_account_id_updated_at: ["account_id", "updated_at", "_creationTime"];
        by_account_id: ["account_id", "_creationTime"];
    }, {}, {}>;
    content_integrations: import("convex/server").TableDefinition<import("convex/values").VObject<{
        id: string;
        account_id: string;
        created_at: number;
        status: string;
        updated_at: number;
        config: any;
        name: string;
        provider: string;
        actor_id: string | null;
    }, {
        id: import("convex/values").VString<string, "required">;
        account_id: import("convex/values").VString<string, "required">;
        provider: import("convex/values").VString<string, "required">;
        name: import("convex/values").VString<string, "required">;
        actor_id: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        config: import("convex/values").VAny<any, "required", string>;
        status: import("convex/values").VString<string, "required">;
        created_at: import("convex/values").VFloat64<number, "required">;
        updated_at: import("convex/values").VFloat64<number, "required">;
    }, "required", "id" | "account_id" | "created_at" | "status" | "updated_at" | "config" | "name" | "provider" | "actor_id" | `config.${string}`>, {
        by_pg_id: ["id", "_creationTime"];
        by_account_id: ["account_id", "_creationTime"];
    }, {}, {}>;
    content_messages: import("convex/server").TableDefinition<import("convex/values").VObject<{
        id: string;
        account_id: string;
        role: string;
        created_at: number;
        content: string;
        conversation_id: string;
        reasoning: string | null;
        tool_calls: any;
    }, {
        id: import("convex/values").VString<string, "required">;
        conversation_id: import("convex/values").VString<string, "required">;
        account_id: import("convex/values").VString<string, "required">;
        role: import("convex/values").VString<string, "required">;
        content: import("convex/values").VString<string, "required">;
        reasoning: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        tool_calls: import("convex/values").VAny<any, "required", string>;
        created_at: import("convex/values").VFloat64<number, "required">;
    }, "required", "id" | "account_id" | "role" | "created_at" | "content" | "conversation_id" | "reasoning" | "tool_calls" | `tool_calls.${string}`>, {
        by_pg_id: ["id", "_creationTime"];
        by_conversation_id_created_at: ["conversation_id", "created_at", "_creationTime"];
        by_conversation_id: ["conversation_id", "_creationTime"];
        by_account_id: ["account_id", "_creationTime"];
    }, {}, {}>;
    content_post_ideas: import("convex/server").TableDefinition<import("convex/values").VObject<{
        id: string;
        account_id: string;
        created_at: number;
        status: string;
        platform: string | null;
        topic: string;
        angle: string | null;
        structure: string | null;
        hook: string | null;
        rationale: string | null;
        sources: any;
        post_id: string | null;
        format: string | null;
        planned_for: string | null;
        plan_id: string | null;
    }, {
        id: import("convex/values").VString<string, "required">;
        account_id: import("convex/values").VString<string, "required">;
        topic: import("convex/values").VString<string, "required">;
        angle: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        structure: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        hook: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        rationale: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        sources: import("convex/values").VAny<any, "required", string>;
        status: import("convex/values").VString<string, "required">;
        post_id: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        created_at: import("convex/values").VFloat64<number, "required">;
        format: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        platform: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        planned_for: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        plan_id: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
    }, "required", "id" | "account_id" | "created_at" | "status" | "platform" | "topic" | "angle" | "structure" | "hook" | "rationale" | "sources" | "post_id" | "format" | "planned_for" | "plan_id" | `sources.${string}`>, {
        by_pg_id: ["id", "_creationTime"];
        by_account_id_status_created_at: ["account_id", "status", "created_at", "_creationTime"];
        by_account_id_plan_id: ["account_id", "plan_id", "_creationTime"];
        by_account_id: ["account_id", "_creationTime"];
        by_post_id: ["post_id", "_creationTime"];
        by_plan_id: ["plan_id", "_creationTime"];
    }, {}, {}>;
    content_posts: import("convex/server").TableDefinition<import("convex/values").VObject<{
        id: string;
        account_id: string;
        created_at: number;
        status: string;
        updated_at: number;
        posted_at: number | null;
        metrics: any;
        conversation_id: string | null;
        hook: string | null;
        format: string | null;
        body: string;
        archetype: string | null;
        skill_slug: string | null;
        source: string;
        linkedin_url: string | null;
        tags: string[];
        image_url: string | null;
    }, {
        id: import("convex/values").VString<string, "required">;
        account_id: import("convex/values").VString<string, "required">;
        conversation_id: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        hook: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        body: import("convex/values").VString<string, "required">;
        archetype: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        status: import("convex/values").VString<string, "required">;
        skill_slug: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        metrics: import("convex/values").VAny<any, "required", string>;
        source: import("convex/values").VString<string, "required">;
        created_at: import("convex/values").VFloat64<number, "required">;
        updated_at: import("convex/values").VFloat64<number, "required">;
        posted_at: import("convex/values").VUnion<number | null, [import("convex/values").VFloat64<number, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        linkedin_url: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        tags: import("convex/values").VArray<string[], import("convex/values").VString<string, "required">, "required">;
        image_url: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        format: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
    }, "required", "id" | "account_id" | "created_at" | "status" | "updated_at" | "posted_at" | "metrics" | `metrics.${string}` | "conversation_id" | "hook" | "format" | "body" | "archetype" | "skill_slug" | "source" | "linkedin_url" | "tags" | "image_url">, {
        by_pg_id: ["id", "_creationTime"];
        by_account_id_created_at: ["account_id", "created_at", "_creationTime"];
        by_account_id: ["account_id", "_creationTime"];
        by_conversation_id: ["conversation_id", "_creationTime"];
    }, {}, {}>;
    content_research_items: import("convex/server").TableDefinition<import("convex/values").VObject<{
        id: string;
        account_id: string;
        summary: string | null;
        title: string | null;
        topic: string | null;
        source: string;
        url: string;
        key_points: any;
        author: string | null;
        score: number | null;
        published_at: number | null;
        fetched_at: number;
    }, {
        id: import("convex/values").VString<string, "required">;
        account_id: import("convex/values").VString<string, "required">;
        source: import("convex/values").VString<string, "required">;
        topic: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        title: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        url: import("convex/values").VString<string, "required">;
        summary: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        key_points: import("convex/values").VAny<any, "required", string>;
        author: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        score: import("convex/values").VUnion<number | null, [import("convex/values").VFloat64<number, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        published_at: import("convex/values").VUnion<number | null, [import("convex/values").VFloat64<number, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        fetched_at: import("convex/values").VFloat64<number, "required">;
    }, "required", "id" | "account_id" | "summary" | "title" | "topic" | "source" | "url" | "key_points" | "author" | "score" | "published_at" | "fetched_at" | `key_points.${string}`>, {
        by_pg_id: ["id", "_creationTime"];
        by_account_id_url: ["account_id", "url", "_creationTime"];
        by_account_id_fetched_at: ["account_id", "fetched_at", "_creationTime"];
        by_account_id: ["account_id", "_creationTime"];
    }, {}, {}>;
    content_scraped_posts: import("convex/server").TableDefinition<import("convex/values").VObject<{
        id: string;
        account_id: string;
        content: string | null;
        source_url: string | null;
        metrics: any;
        scraped_at: number;
        author: string | null;
        integration_id: string | null;
    }, {
        id: import("convex/values").VString<string, "required">;
        account_id: import("convex/values").VString<string, "required">;
        integration_id: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        source_url: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        author: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        content: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        metrics: import("convex/values").VAny<any, "required", string>;
        scraped_at: import("convex/values").VFloat64<number, "required">;
    }, "required", "id" | "account_id" | "content" | "source_url" | "metrics" | "scraped_at" | `metrics.${string}` | "author" | "integration_id">, {
        by_pg_id: ["id", "_creationTime"];
        by_account_id_integration_id: ["account_id", "integration_id", "_creationTime"];
        by_account_id_source_url: ["account_id", "source_url", "_creationTime"];
        by_account_id: ["account_id", "_creationTime"];
        by_integration_id: ["integration_id", "_creationTime"];
    }, {}, {}>;
    content_skill_edit_proposals: import("convex/server").TableDefinition<import("convex/values").VObject<{
        id: string;
        account_id: string;
        created_at: number;
        status: string;
        rationale: string | null;
        skill_id: string;
        skill_file_id: string | null;
        path: string;
        proposed_content: string;
        base_version: number | null;
        change_type: string;
        resolved_at: number | null;
    }, {
        id: import("convex/values").VString<string, "required">;
        account_id: import("convex/values").VString<string, "required">;
        skill_id: import("convex/values").VString<string, "required">;
        skill_file_id: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        path: import("convex/values").VString<string, "required">;
        proposed_content: import("convex/values").VString<string, "required">;
        base_version: import("convex/values").VUnion<number | null, [import("convex/values").VFloat64<number, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        change_type: import("convex/values").VString<string, "required">;
        rationale: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        status: import("convex/values").VString<string, "required">;
        created_at: import("convex/values").VFloat64<number, "required">;
        resolved_at: import("convex/values").VUnion<number | null, [import("convex/values").VFloat64<number, "required">, import("convex/values").VNull<null, "required">], "required", never>;
    }, "required", "id" | "account_id" | "created_at" | "status" | "rationale" | "skill_id" | "skill_file_id" | "path" | "proposed_content" | "base_version" | "change_type" | "resolved_at">, {
        by_pg_id: ["id", "_creationTime"];
        by_account_id_status_created_at: ["account_id", "status", "created_at", "_creationTime"];
        by_account_id: ["account_id", "_creationTime"];
        by_skill_id: ["skill_id", "_creationTime"];
        by_skill_file_id: ["skill_file_id", "_creationTime"];
    }, {}, {}>;
    content_skill_file_versions: import("convex/server").TableDefinition<import("convex/values").VObject<{
        id: string;
        account_id: string;
        created_at: number;
        content: string;
        author: string;
        skill_file_id: string;
        path: string;
        change_type: string;
        version: number;
    }, {
        id: import("convex/values").VString<string, "required">;
        skill_file_id: import("convex/values").VString<string, "required">;
        account_id: import("convex/values").VString<string, "required">;
        path: import("convex/values").VString<string, "required">;
        content: import("convex/values").VString<string, "required">;
        version: import("convex/values").VFloat64<number, "required">;
        change_type: import("convex/values").VString<string, "required">;
        author: import("convex/values").VString<string, "required">;
        created_at: import("convex/values").VFloat64<number, "required">;
    }, "required", "id" | "account_id" | "created_at" | "content" | "author" | "skill_file_id" | "path" | "change_type" | "version">, {
        by_pg_id: ["id", "_creationTime"];
        by_skill_file_id_version: ["skill_file_id", "version", "_creationTime"];
        by_skill_file_id: ["skill_file_id", "_creationTime"];
        by_account_id: ["account_id", "_creationTime"];
    }, {}, {}>;
    content_skill_files: import("convex/server").TableDefinition<import("convex/values").VObject<{
        id: string;
        account_id: string;
        created_at: number;
        content: string;
        updated_at: number;
        skill_id: string;
        path: string;
        version: number;
    }, {
        id: import("convex/values").VString<string, "required">;
        skill_id: import("convex/values").VString<string, "required">;
        account_id: import("convex/values").VString<string, "required">;
        path: import("convex/values").VString<string, "required">;
        content: import("convex/values").VString<string, "required">;
        version: import("convex/values").VFloat64<number, "required">;
        created_at: import("convex/values").VFloat64<number, "required">;
        updated_at: import("convex/values").VFloat64<number, "required">;
    }, "required", "id" | "account_id" | "created_at" | "content" | "updated_at" | "skill_id" | "path" | "version">, {
        by_pg_id: ["id", "_creationTime"];
        by_skill_id_path: ["skill_id", "path", "_creationTime"];
        by_account_id_skill_id: ["account_id", "skill_id", "_creationTime"];
        by_skill_id: ["skill_id", "_creationTime"];
        by_account_id: ["account_id", "_creationTime"];
    }, {}, {}>;
    content_skills: import("convex/server").TableDefinition<import("convex/values").VObject<{
        id: string;
        account_id: string;
        created_at: number;
        slug: string;
        description: string | null;
        updated_at: number;
        name: string;
    }, {
        id: import("convex/values").VString<string, "required">;
        account_id: import("convex/values").VString<string, "required">;
        slug: import("convex/values").VString<string, "required">;
        name: import("convex/values").VString<string, "required">;
        description: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        created_at: import("convex/values").VFloat64<number, "required">;
        updated_at: import("convex/values").VFloat64<number, "required">;
    }, "required", "id" | "account_id" | "created_at" | "slug" | "description" | "updated_at" | "name">, {
        by_pg_id: ["id", "_creationTime"];
        by_account_id_slug: ["account_id", "slug", "_creationTime"];
        by_account_id: ["account_id", "_creationTime"];
    }, {}, {}>;
    dd_runs: import("convex/server").TableDefinition<import("convex/values").VObject<{
        id: string;
        created_at: number;
        slug: string;
        status: "pending" | "ready" | "failed";
        content: any;
        error_message: string | null;
        ready_at: number | null;
        run_input: any;
        storage_path: string;
        pdf_filename: string;
    }, {
        id: import("convex/values").VString<string, "required">;
        slug: import("convex/values").VString<string, "required">;
        status: import("convex/values").VUnion<"pending" | "ready" | "failed", [import("convex/values").VLiteral<"pending", "required">, import("convex/values").VLiteral<"ready", "required">, import("convex/values").VLiteral<"failed", "required">], "required", never>;
        run_input: import("convex/values").VAny<any, "required", string>;
        storage_path: import("convex/values").VString<string, "required">;
        pdf_filename: import("convex/values").VString<string, "required">;
        content: import("convex/values").VAny<any, "required", string>;
        error_message: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        created_at: import("convex/values").VFloat64<number, "required">;
        ready_at: import("convex/values").VUnion<number | null, [import("convex/values").VFloat64<number, "required">, import("convex/values").VNull<null, "required">], "required", never>;
    }, "required", "id" | "created_at" | "slug" | "status" | "content" | "error_message" | "ready_at" | `content.${string}` | "run_input" | "storage_path" | "pdf_filename" | `run_input.${string}`>, {
        by_pg_id: ["id", "_creationTime"];
        by_slug: ["slug", "_creationTime"];
        by_status_created_at: ["status", "created_at", "_creationTime"];
        by_created_at: ["created_at", "_creationTime"];
    }, {}, {}>;
    email_messages: import("convex/server").TableDefinition<import("convex/values").VObject<{
        id: string;
        body: string;
        run_id: string;
        to_address: string;
        subject: string;
        sent_at: number;
        direction: "outbound" | "inbound";
        supplier_id: string | null;
        thread_id: string | null;
    }, {
        id: import("convex/values").VString<string, "required">;
        run_id: import("convex/values").VString<string, "required">;
        to_address: import("convex/values").VString<string, "required">;
        subject: import("convex/values").VString<string, "required">;
        body: import("convex/values").VString<string, "required">;
        sent_at: import("convex/values").VFloat64<number, "required">;
        direction: import("convex/values").VUnion<"outbound" | "inbound", [import("convex/values").VLiteral<"outbound", "required">, import("convex/values").VLiteral<"inbound", "required">], "required", never>;
        supplier_id: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        thread_id: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
    }, "required", "id" | "body" | "run_id" | "to_address" | "subject" | "sent_at" | "direction" | "supplier_id" | "thread_id">, {
        by_pg_id: ["id", "_creationTime"];
        by_run_id_sent_at: ["run_id", "sent_at", "_creationTime"];
        by_run_id: ["run_id", "_creationTime"];
    }, {}, {}>;
    events: import("convex/server").TableDefinition<import("convex/values").VObject<{
        type: string;
        run_id: string;
        seq: number;
        node_id: string;
        ts: number;
        payload: any;
    }, {
        seq: import("convex/values").VFloat64<number, "required">;
        run_id: import("convex/values").VString<string, "required">;
        node_id: import("convex/values").VString<string, "required">;
        type: import("convex/values").VString<string, "required">;
        ts: import("convex/values").VFloat64<number, "required">;
        payload: import("convex/values").VAny<any, "required", string>;
    }, "required", "type" | "run_id" | "seq" | "node_id" | "ts" | "payload" | `payload.${string}`>, {
        by_seq: ["seq", "_creationTime"];
        by_run_id_seq: ["run_id", "seq", "_creationTime"];
        by_run_id: ["run_id", "_creationTime"];
    }, {}, {}>;
    google_credentials: import("convex/server").TableDefinition<import("convex/values").VObject<{
        account_id: string;
        email: string | null;
        updated_at: number;
        google_sub: string | null;
        refresh_secret_id: string;
        scope: string | null;
        history_id: string | null;
        watch_expires_at: number | null;
        agent: string | null;
    }, {
        account_id: import("convex/values").VString<string, "required">;
        google_sub: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        email: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        refresh_secret_id: import("convex/values").VString<string, "required">;
        scope: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        history_id: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        watch_expires_at: import("convex/values").VUnion<number | null, [import("convex/values").VFloat64<number, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        updated_at: import("convex/values").VFloat64<number, "required">;
        agent: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
    }, "required", "account_id" | "email" | "updated_at" | "google_sub" | "refresh_secret_id" | "scope" | "history_id" | "watch_expires_at" | "agent">, {
        by_account_id: ["account_id", "_creationTime"];
    }, {}, {}>;
    human_actions: import("convex/server").TableDefinition<import("convex/values").VObject<{
        id: string;
        type: "send_rfq" | "chase" | "proceed" | "adjudicate" | "reject_quote" | "skip_supplier" | "override_field" | "approve_send" | "reject_send" | "bind";
        run_id: string;
        ts: number;
        payload: any;
    }, {
        id: import("convex/values").VString<string, "required">;
        run_id: import("convex/values").VString<string, "required">;
        type: import("convex/values").VUnion<"send_rfq" | "chase" | "proceed" | "adjudicate" | "reject_quote" | "skip_supplier" | "override_field" | "approve_send" | "reject_send" | "bind", [import("convex/values").VLiteral<"send_rfq", "required">, import("convex/values").VLiteral<"chase", "required">, import("convex/values").VLiteral<"proceed", "required">, import("convex/values").VLiteral<"adjudicate", "required">, import("convex/values").VLiteral<"reject_quote", "required">, import("convex/values").VLiteral<"skip_supplier", "required">, import("convex/values").VLiteral<"override_field", "required">, import("convex/values").VLiteral<"approve_send", "required">, import("convex/values").VLiteral<"reject_send", "required">, import("convex/values").VLiteral<"bind", "required">], "required", never>;
        payload: import("convex/values").VAny<any, "required", string>;
        ts: import("convex/values").VFloat64<number, "required">;
    }, "required", "id" | "type" | "run_id" | "ts" | "payload" | `payload.${string}`>, {
        by_pg_id: ["id", "_creationTime"];
        by_run_id_ts: ["run_id", "ts", "_creationTime"];
        by_run_id: ["run_id", "_creationTime"];
    }, {}, {}>;
    outbound_batches: import("convex/server").TableDefinition<import("convex/values").VObject<{
        id: string;
        created_at: number;
        status: "uploaded" | "running" | "done" | "error" | "cancelled";
        updated_at: number;
        filename: string;
        source_label: string;
        total: number;
        error: string | null;
        counts: any;
        dry_run: boolean;
        batch_cap: number | null;
        region: string | null;
        geo_area: string | null;
    }, {
        id: import("convex/values").VString<string, "required">;
        filename: import("convex/values").VString<string, "required">;
        source_label: import("convex/values").VString<string, "required">;
        total: import("convex/values").VFloat64<number, "required">;
        status: import("convex/values").VUnion<"uploaded" | "running" | "done" | "error" | "cancelled", [import("convex/values").VLiteral<"uploaded", "required">, import("convex/values").VLiteral<"running", "required">, import("convex/values").VLiteral<"done", "required">, import("convex/values").VLiteral<"error", "required">, import("convex/values").VLiteral<"cancelled", "required">], "required", never>;
        counts: import("convex/values").VAny<any, "required", string>;
        dry_run: import("convex/values").VBoolean<boolean, "required">;
        batch_cap: import("convex/values").VUnion<number | null, [import("convex/values").VFloat64<number, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        error: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        created_at: import("convex/values").VFloat64<number, "required">;
        updated_at: import("convex/values").VFloat64<number, "required">;
        region: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        geo_area: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
    }, "required", "id" | "created_at" | "status" | "updated_at" | "filename" | "source_label" | "total" | "error" | "counts" | "dry_run" | "batch_cap" | "region" | "geo_area" | `counts.${string}`>, {
        by_pg_id: ["id", "_creationTime"];
    }, {}, {}>;
    outbound_chat_messages: import("convex/server").TableDefinition<import("convex/values").VObject<{
        id: string;
        role: "user" | "assistant" | "tool" | "system";
        created_at: number;
        content: string;
        lead_id: string;
        reasoning: string | null;
        tool_calls: any;
    }, {
        id: import("convex/values").VString<string, "required">;
        lead_id: import("convex/values").VString<string, "required">;
        role: import("convex/values").VUnion<"user" | "assistant" | "tool" | "system", [import("convex/values").VLiteral<"user", "required">, import("convex/values").VLiteral<"assistant", "required">, import("convex/values").VLiteral<"tool", "required">, import("convex/values").VLiteral<"system", "required">], "required", never>;
        content: import("convex/values").VString<string, "required">;
        reasoning: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        tool_calls: import("convex/values").VAny<any, "required", string>;
        created_at: import("convex/values").VFloat64<number, "required">;
    }, "required", "id" | "role" | "created_at" | "content" | "lead_id" | "reasoning" | "tool_calls" | `tool_calls.${string}`>, {
        by_pg_id: ["id", "_creationTime"];
        by_lead_id_created_at: ["lead_id", "created_at", "_creationTime"];
        by_lead_id: ["lead_id", "_creationTime"];
    }, {}, {}>;
    outbound_config: import("convex/server").TableDefinition<import("convex/values").VObject<{
        updated_at: number;
        key: string;
        value: any;
    }, {
        key: import("convex/values").VString<string, "required">;
        value: import("convex/values").VAny<any, "required", string>;
        updated_at: import("convex/values").VFloat64<number, "required">;
    }, "required", "updated_at" | "key" | "value" | `value.${string}`>, {
        by_key: ["key", "_creationTime"];
    }, {}, {}>;
    outbound_events: import("convex/server").TableDefinition<import("convex/values").VObject<{
        type: string;
        lead_id: string | null;
        seq: number;
        ts: number;
        payload: any;
        batch_id: string;
    }, {
        seq: import("convex/values").VFloat64<number, "required">;
        batch_id: import("convex/values").VString<string, "required">;
        lead_id: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        type: import("convex/values").VString<string, "required">;
        ts: import("convex/values").VFloat64<number, "required">;
        payload: import("convex/values").VAny<any, "required", string>;
    }, "required", "type" | "lead_id" | "seq" | "ts" | "payload" | `payload.${string}` | "batch_id">, {
        by_seq: ["seq", "_creationTime"];
        by_batch_id_seq: ["batch_id", "seq", "_creationTime"];
        by_batch_id: ["batch_id", "_creationTime"];
        by_lead_id: ["lead_id", "_creationTime"];
    }, {}, {}>;
    outbound_leads: import("convex/server").TableDefinition<import("convex/values").VObject<{
        id: string;
        created_at: number;
        status: "pending" | "ready" | "error" | "enriching" | "researching" | "drafting" | "approved" | "sent" | "skipped";
        email: string | null;
        updated_at: number;
        title: string | null;
        linkedin_url: string | null;
        error: string | null;
        batch_id: string;
        position: number;
        raw: any;
        full_name: string | null;
        first_name: string | null;
        last_name: string | null;
        company: string | null;
        website: string | null;
        location: string | null;
        industry: string | null;
        vertical: string | null;
        matched_client: string | null;
        icp_verdict: "serve" | "skip" | null;
        enrichment: any;
        brief: any;
        competitor_1: string | null;
        competitor_2: string | null;
        assistant_key: string | null;
    }, {
        id: import("convex/values").VString<string, "required">;
        batch_id: import("convex/values").VString<string, "required">;
        position: import("convex/values").VFloat64<number, "required">;
        raw: import("convex/values").VAny<any, "required", string>;
        full_name: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        first_name: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        last_name: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        company: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        title: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        website: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        linkedin_url: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        email: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        location: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        industry: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        status: import("convex/values").VUnion<"pending" | "ready" | "error" | "enriching" | "researching" | "drafting" | "approved" | "sent" | "skipped", [import("convex/values").VLiteral<"pending", "required">, import("convex/values").VLiteral<"enriching", "required">, import("convex/values").VLiteral<"researching", "required">, import("convex/values").VLiteral<"drafting", "required">, import("convex/values").VLiteral<"ready", "required">, import("convex/values").VLiteral<"approved", "required">, import("convex/values").VLiteral<"sent", "required">, import("convex/values").VLiteral<"skipped", "required">, import("convex/values").VLiteral<"error", "required">], "required", never>;
        error: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        vertical: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        matched_client: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        icp_verdict: import("convex/values").VUnion<"serve" | "skip" | null, [import("convex/values").VLiteral<"serve", "required">, import("convex/values").VLiteral<"skip", "required">, import("convex/values").VNull<null, "required">], "required", never>;
        enrichment: import("convex/values").VAny<any, "required", string>;
        brief: import("convex/values").VAny<any, "required", string>;
        created_at: import("convex/values").VFloat64<number, "required">;
        updated_at: import("convex/values").VFloat64<number, "required">;
        competitor_1: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        competitor_2: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        assistant_key: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
    }, "required", "id" | "created_at" | "status" | "email" | "updated_at" | "title" | "linkedin_url" | "error" | "batch_id" | "position" | "raw" | "full_name" | "first_name" | "last_name" | "company" | "website" | "location" | "industry" | "vertical" | "matched_client" | "icp_verdict" | "enrichment" | "brief" | "competitor_1" | "competitor_2" | "assistant_key" | `raw.${string}` | `enrichment.${string}` | `brief.${string}`>, {
        by_pg_id: ["id", "_creationTime"];
        by_batch_id_position: ["batch_id", "position", "_creationTime"];
        by_batch_id_linkedin_url: ["batch_id", "linkedin_url", "_creationTime"];
        by_batch_id: ["batch_id", "_creationTime"];
    }, {}, {}>;
    outbound_scrape_state: import("convex/server").TableDefinition<import("convex/values").VObject<{
        updated_at: number;
        batch_id: string;
        pending_leads: number;
        listing_complete: boolean;
    }, {
        batch_id: import("convex/values").VString<string, "required">;
        pending_leads: import("convex/values").VFloat64<number, "required">;
        listing_complete: import("convex/values").VBoolean<boolean, "required">;
        updated_at: import("convex/values").VFloat64<number, "required">;
    }, "required", "updated_at" | "batch_id" | "pending_leads" | "listing_complete">, {
        by_batch_id: ["batch_id", "_creationTime"];
    }, {}, {}>;
    outbound_scrapes: import("convex/server").TableDefinition<import("convex/values").VObject<{
        id: string;
        lead_id: string;
        fetched_at: number;
        error: string | null;
        raw: any;
        text: string | null;
        ok: boolean;
        kind: "website" | "linkedin" | "posts";
    }, {
        id: import("convex/values").VString<string, "required">;
        lead_id: import("convex/values").VString<string, "required">;
        kind: import("convex/values").VUnion<"website" | "linkedin" | "posts", [import("convex/values").VLiteral<"website", "required">, import("convex/values").VLiteral<"linkedin", "required">, import("convex/values").VLiteral<"posts", "required">], "required", never>;
        text: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        raw: import("convex/values").VAny<any, "required", string>;
        ok: import("convex/values").VBoolean<boolean, "required">;
        error: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        fetched_at: import("convex/values").VFloat64<number, "required">;
    }, "required", "id" | "lead_id" | "fetched_at" | "error" | "raw" | `raw.${string}` | "text" | "ok" | "kind">, {
        by_pg_id: ["id", "_creationTime"];
        by_lead_id_kind: ["lead_id", "kind", "_creationTime"];
        by_lead_id: ["lead_id", "_creationTime"];
    }, {}, {}>;
    outbound_sequence_versions: import("convex/server").TableDefinition<import("convex/values").VObject<{
        id: string;
        created_at: number;
        lead_id: string;
        sequence: any;
    }, {
        id: import("convex/values").VString<string, "required">;
        lead_id: import("convex/values").VString<string, "required">;
        sequence: import("convex/values").VAny<any, "required", string>;
        created_at: import("convex/values").VFloat64<number, "required">;
    }, "required", "id" | "created_at" | "lead_id" | "sequence" | `sequence.${string}`>, {
        by_pg_id: ["id", "_creationTime"];
        by_lead_id_created_at: ["lead_id", "created_at", "_creationTime"];
        by_lead_id: ["lead_id", "_creationTime"];
    }, {}, {}>;
    outbound_sequences: import("convex/server").TableDefinition<import("convex/values").VObject<{
        id: string;
        created_at: number;
        status: "approved" | "sent" | "draft" | "edited";
        lead_id: string;
        updated_at: number;
        rationale: any;
        sent_at: number | null;
        connection_note: string | null;
        opener: string | null;
        follow_up_1: string | null;
        follow_up_2: string | null;
        reply_handlers: any;
        skill_version: number | null;
        edited: any;
        email_subject: string | null;
        email_body: string | null;
        linkedin_dm: string | null;
        deliverable: any;
        message: string | null;
    }, {
        id: import("convex/values").VString<string, "required">;
        lead_id: import("convex/values").VString<string, "required">;
        connection_note: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        opener: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        follow_up_1: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        follow_up_2: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        reply_handlers: import("convex/values").VAny<any, "required", string>;
        rationale: import("convex/values").VAny<any, "required", string>;
        skill_version: import("convex/values").VUnion<number | null, [import("convex/values").VFloat64<number, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        status: import("convex/values").VUnion<"approved" | "sent" | "draft" | "edited", [import("convex/values").VLiteral<"draft", "required">, import("convex/values").VLiteral<"edited", "required">, import("convex/values").VLiteral<"approved", "required">, import("convex/values").VLiteral<"sent", "required">], "required", never>;
        edited: import("convex/values").VAny<any, "required", string>;
        sent_at: import("convex/values").VUnion<number | null, [import("convex/values").VFloat64<number, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        created_at: import("convex/values").VFloat64<number, "required">;
        updated_at: import("convex/values").VFloat64<number, "required">;
        email_subject: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        email_body: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        linkedin_dm: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        deliverable: import("convex/values").VAny<any, "required", string>;
        message: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
    }, "required", "id" | "created_at" | "status" | "lead_id" | "updated_at" | "rationale" | "sent_at" | "connection_note" | "opener" | "follow_up_1" | "follow_up_2" | "reply_handlers" | "skill_version" | "edited" | "email_subject" | "email_body" | "linkedin_dm" | "deliverable" | "message" | `rationale.${string}` | `reply_handlers.${string}` | `edited.${string}` | `deliverable.${string}`>, {
        by_pg_id: ["id", "_creationTime"];
        by_lead_id: ["lead_id", "_creationTime"];
    }, {}, {}>;
    outbound_skill_edit_proposals: import("convex/server").TableDefinition<import("convex/values").VObject<{
        id: string;
        created_at: number;
        status: "pending" | "approved" | "rejected";
        rationale: string;
        skill_id: string;
        path: string;
        proposed_content: string;
        base_version: number | null;
        resolved_at: number | null;
    }, {
        id: import("convex/values").VString<string, "required">;
        skill_id: import("convex/values").VString<string, "required">;
        path: import("convex/values").VString<string, "required">;
        proposed_content: import("convex/values").VString<string, "required">;
        base_version: import("convex/values").VUnion<number | null, [import("convex/values").VFloat64<number, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        rationale: import("convex/values").VString<string, "required">;
        status: import("convex/values").VUnion<"pending" | "approved" | "rejected", [import("convex/values").VLiteral<"pending", "required">, import("convex/values").VLiteral<"approved", "required">, import("convex/values").VLiteral<"rejected", "required">], "required", never>;
        created_at: import("convex/values").VFloat64<number, "required">;
        resolved_at: import("convex/values").VUnion<number | null, [import("convex/values").VFloat64<number, "required">, import("convex/values").VNull<null, "required">], "required", never>;
    }, "required", "id" | "created_at" | "status" | "rationale" | "skill_id" | "path" | "proposed_content" | "base_version" | "resolved_at">, {
        by_pg_id: ["id", "_creationTime"];
        by_status_created_at: ["status", "created_at", "_creationTime"];
        by_skill_id: ["skill_id", "_creationTime"];
    }, {}, {}>;
    outbound_skill_file_versions: import("convex/server").TableDefinition<import("convex/values").VObject<{
        id: string;
        created_at: number;
        content: string;
        author: "agent" | "user";
        skill_file_id: string;
        change_type: "create" | "append" | "overwrite" | "rollback";
        version: number;
    }, {
        id: import("convex/values").VString<string, "required">;
        skill_file_id: import("convex/values").VString<string, "required">;
        version: import("convex/values").VFloat64<number, "required">;
        content: import("convex/values").VString<string, "required">;
        change_type: import("convex/values").VUnion<"create" | "append" | "overwrite" | "rollback", [import("convex/values").VLiteral<"create", "required">, import("convex/values").VLiteral<"append", "required">, import("convex/values").VLiteral<"overwrite", "required">, import("convex/values").VLiteral<"rollback", "required">], "required", never>;
        author: import("convex/values").VUnion<"agent" | "user", [import("convex/values").VLiteral<"agent", "required">, import("convex/values").VLiteral<"user", "required">], "required", never>;
        created_at: import("convex/values").VFloat64<number, "required">;
    }, "required", "id" | "created_at" | "content" | "author" | "skill_file_id" | "change_type" | "version">, {
        by_pg_id: ["id", "_creationTime"];
        by_skill_file_id_version: ["skill_file_id", "version", "_creationTime"];
        by_skill_file_id: ["skill_file_id", "_creationTime"];
    }, {}, {}>;
    outbound_skill_files: import("convex/server").TableDefinition<import("convex/values").VObject<{
        id: string;
        content: string;
        updated_at: number;
        skill_id: string;
        path: string;
        version: number;
    }, {
        id: import("convex/values").VString<string, "required">;
        skill_id: import("convex/values").VString<string, "required">;
        path: import("convex/values").VString<string, "required">;
        content: import("convex/values").VString<string, "required">;
        version: import("convex/values").VFloat64<number, "required">;
        updated_at: import("convex/values").VFloat64<number, "required">;
    }, "required", "id" | "content" | "updated_at" | "skill_id" | "path" | "version">, {
        by_pg_id: ["id", "_creationTime"];
        by_skill_id_path: ["skill_id", "path", "_creationTime"];
        by_skill_id: ["skill_id", "_creationTime"];
    }, {}, {}>;
    outbound_skills: import("convex/server").TableDefinition<import("convex/values").VObject<{
        id: string;
        created_at: number;
        slug: string;
        description: string;
        name: string;
    }, {
        id: import("convex/values").VString<string, "required">;
        slug: import("convex/values").VString<string, "required">;
        name: import("convex/values").VString<string, "required">;
        description: import("convex/values").VString<string, "required">;
        created_at: import("convex/values").VFloat64<number, "required">;
    }, "required", "id" | "created_at" | "slug" | "description" | "name">, {
        by_pg_id: ["id", "_creationTime"];
        by_slug: ["slug", "_creationTime"];
    }, {}, {}>;
    run_channels: import("convex/server").TableDefinition<import("convex/values").VObject<{
        id: string;
        created_at: number;
        run_id: string;
        kind: string;
        channel: string;
        thread_ts: string | null;
    }, {
        id: import("convex/values").VString<string, "required">;
        run_id: import("convex/values").VString<string, "required">;
        kind: import("convex/values").VString<string, "required">;
        channel: import("convex/values").VString<string, "required">;
        thread_ts: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        created_at: import("convex/values").VFloat64<number, "required">;
    }, "required", "id" | "created_at" | "run_id" | "kind" | "channel" | "thread_ts">, {
        by_pg_id: ["id", "_creationTime"];
        by_run_id: ["run_id", "_creationTime"];
    }, {}, {}>;
    runs: import("convex/server").TableDefinition<import("convex/values").VObject<{
        id: string;
        created_at: number;
        slug: string;
        status: "pending" | "ready" | "failed" | "running" | "awaiting_human";
        error_message: string | null;
        ready_at: number | null;
        submission_label: string;
        scenario: string;
        case_file: any;
        bound_policy: any;
    }, {
        id: import("convex/values").VString<string, "required">;
        slug: import("convex/values").VString<string, "required">;
        status: import("convex/values").VUnion<"pending" | "ready" | "failed" | "running" | "awaiting_human", [import("convex/values").VLiteral<"pending", "required">, import("convex/values").VLiteral<"running", "required">, import("convex/values").VLiteral<"awaiting_human", "required">, import("convex/values").VLiteral<"ready", "required">, import("convex/values").VLiteral<"failed", "required">], "required", never>;
        submission_label: import("convex/values").VString<string, "required">;
        scenario: import("convex/values").VString<string, "required">;
        case_file: import("convex/values").VAny<any, "required", string>;
        bound_policy: import("convex/values").VAny<any, "required", string>;
        error_message: import("convex/values").VUnion<string | null, [import("convex/values").VString<string, "required">, import("convex/values").VNull<null, "required">], "required", never>;
        created_at: import("convex/values").VFloat64<number, "required">;
        ready_at: import("convex/values").VUnion<number | null, [import("convex/values").VFloat64<number, "required">, import("convex/values").VNull<null, "required">], "required", never>;
    }, "required", "id" | "created_at" | "slug" | "status" | "error_message" | "ready_at" | "submission_label" | "scenario" | "case_file" | "bound_policy" | `case_file.${string}` | `bound_policy.${string}`>, {
        by_pg_id: ["id", "_creationTime"];
        by_slug: ["slug", "_creationTime"];
        by_created_at: ["created_at", "_creationTime"];
    }, {}, {}>;
}, true>;
export default _default;
