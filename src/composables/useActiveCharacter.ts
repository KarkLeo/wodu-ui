import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useRoute } from 'vue-router'
import { useCharactersStore } from '@/stores/characters'
import type { CharacterCommand } from '@/domain/commands'

export function useActiveCharacter(explicitId?: MaybeRefOrGetter<string | undefined>) {
  const route = useRoute()
  const store = useCharactersStore()
  const id = computed(() => toValue(explicitId) ?? (route.params.id as string))
  const char = computed(() => store.getById(id.value))
  const dispatch = (cmd: CharacterCommand) => {
    if (id.value) store.dispatch(id.value, cmd)
  }
  return { id, char, dispatch }
}
