DROP VIEW IF EXISTS vw_total_users_point;
DROP VIEW IF EXISTS vw_user_points_rewards;
ALTER TABLE "users_score" ALTER COLUMN "point" SET DATA TYPE numeric(20, 6);

-- View: public.vw_total_users_point

-- DROP VIEW public.vw_total_users_point;

CREATE OR REPLACE VIEW public.vw_total_users_point
 AS
SELECT users_score.user_id,
       users.username,
       sum(users_score.point) AS total_points,
       sum(users_score.point) FILTER (WHERE users_score.activity_type = 'free_online_event'::users_score_activity_type) AS free_online_event_points,
    sum(users_score.point) FILTER (WHERE users_score.activity_type = 'free_offline_event'::users_score_activity_type) AS free_offline_event_points,
    sum(users_score.point) FILTER (WHERE users_score.activity_type = 'paid_online_event'::users_score_activity_type) AS paid_online_event_points,
    sum(users_score.point) FILTER (WHERE users_score.activity_type = 'paid_offline_event'::users_score_activity_type) AS paid_offline_event_points,
    sum(users_score.point) FILTER (WHERE users_score.activity_type = 'join_onton'::users_score_activity_type) AS join_onton_points,
    sum(users_score.point) FILTER (WHERE users_score.activity_type = 'join_onton_affiliate'::users_score_activity_type) AS join_onton_affiliate
FROM users_score
         JOIN users ON users_score.user_id = users.user_id
GROUP BY users_score.user_id, users.username
ORDER BY (sum(users_score.point)) DESC;

-- View: public.vw_user_points_rewards

-- DROP VIEW public.vw_user_points_rewards;

CREATE OR REPLACE VIEW public.vw_user_points_rewards
 AS
 WITH unique_visitor AS (
         SELECT visitors.event_uuid,
            visitors.user_id,
            min(visitors.id) AS min_visitor_id
           FROM visitors
          GROUP BY visitors.event_uuid, visitors.user_id
        )
SELECT e.event_id,
       e.event_uuid,
       e.title,
       u.user_id,
       u.username,
       to_char(to_timestamp(e.end_date::double precision), 'YYYY-MM-DD HH24:MI:SS'::text) AS end_date_human,
       v.created_at AS visit_created_at,
       v.last_visit AS visit_last_visit,
       us.point AS user_score,
       r.id AS reward_uuid,
       r.data AS reward_data,
       r.ton_society_status AS claim_status,
       CASE
           WHEN r.id IS NOT NULL THEN false
           ELSE true
           END AS is_sbt_debt
FROM unique_visitor uv
         JOIN visitors v ON v.id = uv.min_visitor_id
         JOIN events e ON e.event_uuid = uv.event_uuid
         JOIN users u ON u.user_id = uv.user_id
         LEFT JOIN users_score us ON us.user_id = u.user_id AND us.item_type = 'event'::user_score_item_type AND us.item_id = e.event_id
     LEFT JOIN LATERAL ( SELECT r2.id,
            r2.data,
            r2.ton_society_status
           FROM rewards r2
          WHERE r2.visitor_id = v.id AND r2.type = 'ton_society_sbt'::reward_types
          ORDER BY r2.created_at DESC
         LIMIT 1) r ON true;





