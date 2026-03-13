import { Pressable, Text } from 'react-native';

interface QuizTileProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

export function QuizTile({ label, selected, onPress }: QuizTileProps) {
  return (
    <Pressable
      onPress={onPress}
      className={`
        flex-1 min-w-[45%] mx-1 mb-3 py-5 px-4 rounded-2xl
        border-2 items-center justify-center
        ${selected
          ? 'bg-zinc-900 border-zinc-900'
          : 'bg-white border-zinc-200'
        }
      `}
    >
      <Text
        className={`
          text-base font-semibold text-center
          ${selected ? 'text-white' : 'text-zinc-900'}
        `}
      >
        {label}
      </Text>
    </Pressable>
  );
}
