;; Decentralized Autonomous Sports Betting Platform

;; Constants
(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-not-found (err u101))
(define-constant err-unauthorized (err u102))
(define-constant err-bet-closed (err u103))
(define-constant err-oracle-only (err u104))
(define-constant err-already-reported (err u105))
(define-constant err-insufficient-balance (err u106))
(define-constant err-transfer-failed (err u107))
(define-constant err-bet-list-full (err u108))

;; Data variables
(define-data-var next-event-id uint u1)
(define-data-var oracle-address principal contract-owner)

;; Data maps
(define-map betting-events
  { event-id: uint }
  {
    description: (string-ascii 256),
    options: (list 10 (string-ascii 64)),
    total-pool: uint,
    bets: (list 1000 {better: principal, option: uint, amount: uint}),
    status: (string-ascii 20),
    result: (optional uint)
  }
)

(define-map user-bets
  { user: principal, event-id: uint }
  { amount: uint }
)

;; Private functions
(define-private (is-owner)
  (is-eq tx-sender contract-owner)
)

(define-private (is-oracle)
  (is-eq tx-sender (var-get oracle-address))
)

;; Public functions
(define-public (create-event (description (string-ascii 256)) (options (list 10 (string-ascii 64))))
  (let
    (
      (event-id (var-get next-event-id))
    )
    (map-set betting-events
      {event-id: event-id}
      {
        description: description,
        options: options,
        total-pool: u0,
        bets: (list),
        status: "open",
        result: none
      }
    )
    (var-set next-event-id (+ event-id u1))
    (ok event-id)
  )
)

(define-public (place-bet (event-id uint) (option uint) (amount uint))
  (let
    (
      (event (unwrap! (map-get? betting-events {event-id: event-id}) (err err-not-found)))
      (current-bet (default-to { amount: u0 } (map-get? user-bets {user: tx-sender, event-id: event-id})))
    )
    (asserts! (is-eq (get status event) "open") (err err-bet-closed))
    (asserts! (>= (stx-get-balance tx-sender) amount) (err err-insufficient-balance))
    (match (stx-transfer? amount tx-sender (as-contract tx-sender))
      success (let
        (
          (updated-bets (as-max-len? (append (get bets event) {better: tx-sender, option: option, amount: amount}) u1000))
        )
        (match updated-bets
          new-bets (begin
            (map-set betting-events
              {event-id: event-id}
              (merge event {
                total-pool: (+ (get total-pool event) amount),
                bets: new-bets
              })
            )
            (map-set user-bets
              {user: tx-sender, event-id: event-id}
              {amount: (+ (get amount current-bet) amount)}
            )
            (ok true))
          (err err-bet-list-full)))
      error (err err-transfer-failed)
    )
  )
)

(define-public (report-result (event-id uint) (result uint))
  (let
    (
      (event (unwrap! (map-get? betting-events {event-id: event-id}) (err err-not-found)))
    )
    (asserts! (is-oracle) (err err-oracle-only))
    (asserts! (is-none (get result event)) (err err-already-reported))
    (map-set betting-events
      {event-id: event-id}
      (merge event {
        status: "closed",
        result: (some result)
      })
    )
    (ok true)
  )
)

;; Read-only functions
(define-read-only (get-event (event-id uint))
  (map-get? betting-events {event-id: event-id})
)

(define-read-only (get-user-bet (user principal) (event-id uint))
  (map-get? user-bets {user: user, event-id: event-id})
)

;; Admin functions
(define-public (set-oracle (new-oracle principal))
  (begin
    (asserts! (is-owner) (err err-owner-only))
    (ok (var-set oracle-address new-oracle))
  )
)

