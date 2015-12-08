(ns metabase.models.segment
  (:require [korma.core :as k]
            [medley.core :as m]
            [metabase.config :as config]
            [metabase.db :as db]
            [metabase.events :as events]
            (metabase.models [common :refer [perms-readwrite]]
                             [hydrate :refer :all]
                             [interface :refer :all]
                             [revision :as revision]
                             [user :refer [User]])
            [metabase.util :as u]))


(defrecord SegmentInstance []
  ;; preserve normal IFn behavior so things like ((sel :one Database) :id) work correctly
  clojure.lang.IFn
  (invoke [this k]
    (get this k)))

(extend-ICanReadWrite SegmentInstance :read :always, :write :superuser)


(defentity Segment
  [(k/table :segment)
   (hydration-keys segment)
   (types :definition :json)
   timestamped]

  (post-select [_ {:keys [creator_id description] :as segment}]
    (map->SegmentInstance
      (assoc segment
        :creator     (delay (when creator_id (db/sel :one User :id creator_id)))
        :description (u/jdbc-clob->str description))))

  (pre-cascade-delete [_ {:keys [id]}]
    (if (config/is-prod?)
      ;; in prod we prevent any deleting
      (throw (Exception. "deleting a Segment is not supported."))
      ;; in test we allow deleting
      (db/cascade-delete revision/Revision :model "Segment" :model_id id))))

(extend-ICanReadWrite SegmentEntity :read :always, :write :superuser)


;; ## Persistence Functions

(defn create-segment
  "Create a new `Segment`.

   Returns the newly created `Segment` or throws an Exception."
  [table-id name description creator-id definition]
  {:pre [(integer? table-id)
         (string? name)
         (integer? creator-id)
         (map? definition)]}
  (let [segment (db/ins Segment
                  :table_id    table-id
                  :creator_id  creator-id
                  :name        name
                  :description description
                  :is_active   true
                  :definition  definition)]
    (-> (events/publish-event :segment-create segment)
        (hydrate :creator))))

(defn exists-segment?
  "Predicate function which checks for a given `Segment` with ID.
   Returns true if `Segment` exists and is active, false otherwise."
  [id]
  {:pre [(integer? id)]}
  (db/exists? Segment :id id :is_active true))

(defn retrieve-segment
  "Fetch a single `Segment` by its ID value."
  [id]
  {:pre [(integer? id)]}
  (-> (db/sel :one Segment :id id)
      (hydrate :creator)))

(defn retrieve-segments
  "Fetch all `Segments` for a given `Table`.  Optional second argument allows filtering by active state by
   providing one of 3 keyword values: `:active`, `:deleted`, `:all`.  Default filtering is for `:active`."
  ([table-id]
    (retrieve-segments table-id :active))
  ([table-id state]
   {:pre [(integer? table-id)
          (keyword? state)]}
   (-> (if (= :all state)
         (db/sel :many Segment :table_id table-id (k/order :name :ASC))
         (db/sel :many Segment :table_id table-id :is_active (if (= :active state) true false) (k/order :name :ASC)))
       (hydrate :creator))))

(defn update-segment
  "Update an existing `Segment`.

   Returns the updated `Segment` or throws an Exception."
  [{:keys [id name description definition revision_message]} user-id]
  {:pre [(integer? id)
         (string? name)
         (map? definition)
         (integer? user-id)
         (string? revision_message)]}
  ;; update the segment itself
  (db/upd Segment id
    :name        name
    :description description
    :definition  definition)
  (let [segment (retrieve-segment id)]
    ;; fire off an event
    (events/publish-event :segment-update (assoc segment :actor_id user-id :revision_message revision_message))
    ;; return the updated segment
    segment))

(defn delete-segment
  "Delete a `Segment`.

   This does a soft delete and simply marks the `Segment` as deleted but does not actually remove the
   record from the database at any time.

   Returns the final state of the `Segment` is successful, or throws an Exception."
  [id user-id]
  {:pre [(integer? id)]}
  ;; make Segment not active
  (db/upd Segment id :is_active false)
  ;; retrieve the updated segment (now retired)
  (let [segment (retrieve-segment id)]
    ;; fire off an event
    (events/publish-event :segment-delete (assoc segment :actor_id user-id))
    ;; return the updated segment
    segment))


;;; ## ---------------------------------------- REVISIONS ----------------------------------------


(defn- serialize-instance [_ _ instance]
  (->> (dissoc instance :created_at :updated_at)
       (into {})                                 ; if it's a record type like SegmentInstance we need to convert it to a regular map or filter-vals won't work
       (m/filter-vals (complement delay?))))

(extend SegmentEntity
  revision/IRevisioned
  {:serialize-instance serialize-instance
   :revert-to-revision revision/default-revert-to-revision
   :describe-diff      revision/default-describe-diff})
