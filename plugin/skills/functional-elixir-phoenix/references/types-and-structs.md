# Types and Structs in Elixir

## Structs with enforced keys

```elixir
defmodule Clinic.Scheduling.Slot do
  @enforce_keys [:id, :doctor, :starts_at, :duration]
  defstruct [:id, :doctor, :starts_at, :duration]
end
```

`@enforce_keys` makes `%Slot{}` a compile error unless every listed key
is given. Without it, a struct is a map of maybes and every consumer
checks for `nil`.

List every key that is genuinely required, which in a domain struct is
usually all of them. A field that is legitimately absent should be a
tagged tuple that names both meanings, not a bare `nil`.

## Single-case wrappers

```elixir
defmodule Clinic.Scheduling.Slot.Id do
  @enforce_keys [:value]
  defstruct [:value]

  @opaque t :: %__MODULE__{value: binary()}

  @spec new(binary()) :: {:ok, t()} | {:error, :invalid_slot_id}
  def new(raw) when is_binary(raw) do
    case Ecto.UUID.cast(raw) do
      {:ok, uuid} -> {:ok, %__MODULE__{value: uuid}}
      :error -> {:error, :invalid_slot_id}
    end
  end

  def new(_), do: {:error, :invalid_slot_id}

  @spec value(t()) :: binary()
  def value(%__MODULE__{value: v}), do: v
end
```

`@opaque` tells Dialyzer that other modules must not depend on the
internal shape, which is as close to a private constructor as Elixir
gets. Pattern matching on `%Slot.Id{value: v}` from another module still
works at runtime, so the discipline is partly conventional; Dialyzer and
review carry the rest.

The gain is real even so: `Slot.Id` and `Patient.Id` no longer match each
other's function clauses, so transposed arguments raise immediately.

## Tagged tuples for choices

```elixir
@type payment ::
        :cash
        | {:card, CardNumber.t(), Expiry.t()}
        | {:transfer, BankCode.t(), Reference.t()}
```

Dispatch with function clauses, one per case:

```elixir
def describe(:cash), do: "cash"
def describe({:card, number, _}), do: CardNumber.mask(number)
def describe({:transfer, bank, _}), do: BankCode.to_string(bank)
```

No catch-all. An unmatched value raises `FunctionClauseError` with the
value in the message, which is a loud, findable bug rather than a wrong
answer. That is Elixir's substitute for an exhaustiveness check, and it
only works if you do not add `def describe(_), do: "unknown"`.

For cases with several fields, a struct per case reads better than a
wide tuple:

```elixir
@type status ::
        %Status.Pending{}
        | %Status.Shipped{}
        | %Status.Delivered{}
```

## Guards as constraints

```elixir
def new(quantity) when is_integer(quantity) and quantity > 0 do
  {:ok, %__MODULE__{value: quantity}}
end

def new(_), do: {:error, :invalid_quantity}
```

Two clauses: the valid path, and everything else. Guards keep the rule
visible in the head rather than buried in a conditional.

## Typespecs and Dialyzer

```elixir
@spec confirm(t(), DateTime.t()) ::
        {:ok, t()} | {:error, :not_held | :hold_expired}
```

The spec is the contract from
[designing-deep-modules](../../designing-deep-modules/SKILL.md), and it
is checkable. Rules that make it worth having:

1. `@spec` on every public function. Private functions benefit less.
2. Enumerate error atoms in the spec, so callers can see the cases.
3. Run Dialyzer in CI and treat warnings as failures. A spec nothing
   checks is a comment that will drift.
4. Use `@type` for domain concepts and `@opaque` for wrappers whose
   internals are private.

Dialyzer proves absence of type errors rather than presence of
correctness, so it will not catch everything a stricter language would.
It does catch the impossible-match and unreachable-clause mistakes that
follow from a refactor, which is most of the value.

## Immutability caveats

Elixir data is immutable, so the mutation problems in the core skill do
not arise. Two things still need care:

- **Process state.** A GenServer's state is a value replaced on each
  message, but the process itself is a mutable cell. Keep it in one
  place and treat updates as transitions. See
  [otp-and-liveview.md](otp-and-liveview.md).
- **ETS and the database.** Both are shared mutable state with their own
  concurrency semantics. Wrap them behind functions and keep the domain
  unaware.

## Testing

```elixir
test "confirming an expired hold fails" do
  appt = held_appointment(held_at: ~U[2026-03-01 09:00:00Z])
  now = ~U[2026-03-01 09:05:00Z]
  assert {:error, :hold_expired} = Appointment.confirm(appt, now)
end
```

Plain values, no sandbox, no processes. `now` is a parameter, which is
what makes the test deterministic. Property tests over generated structs
suit constructors and folds particularly well; use them to assert that
`new/1` never returns an invalid struct for any input.
