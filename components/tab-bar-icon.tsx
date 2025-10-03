import {FontAwesome} from '@expo/vector-icons';

export function TabBarIcon({
    name,
    color
}:{
    name: React.ComponentProps<typeof FontAwesome>['name'];
    color: string;
}){
    return <FontAwesome size={28} style={{ marginBottom: -3 }} name={name} color={color} />;
}
