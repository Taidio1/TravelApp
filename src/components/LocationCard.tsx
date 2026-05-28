import React from 'react';
import Card from './Card';
import Button from './Button';
import { ThumbsUp, MapPin } from 'lucide-react';

interface LocationCardProps {
  place: any;
  votes: any[];
  onVote: (placeId: string) => void;
  onFinalize?: (placeId: string) => void;
  isAdmin?: boolean;
}

const LocationCard: React.FC<LocationCardProps> = ({ place, votes, onVote, onFinalize, isAdmin }) => {
  const voteCount = votes.filter(v => v.place_id === place.id).length;

  return (
    <Card className="flex flex-col gap-4 w-full max-w-sm">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-xl font-bold text-gray-800">{place.name}</h3>
          <p className="text-sm text-gray-500 flex items-center gap-1">
            <MapPin size={14} /> {place.category}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-spanish-orange">{voteCount}/6</span>
          <Button 
            size="icon" 
            variant="neutral" 
            onClick={() => onVote(place.id)}
            className="w-10 h-10"
          >
            <ThumbsUp size={18} className="text-spanish-orange" />
          </Button>
        </div>
      </div>
      
      <p className="text-gray-600 text-sm leading-relaxed">
        {place.description}
      </p>

      {isAdmin && place.status === 'proposed' && (
        <Button 
          variant="primary" 
          onClick={() => onFinalize && onFinalize(place.id)}
          className="mt-2"
        >
          Add to Daily Plan
        </Button>
      )}
    </Card>
  );
};

export default LocationCard;
